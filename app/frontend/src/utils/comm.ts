/**
 * Communication Protocol Handler for VishMaker ↔ VishCoder
 * 
 * This module handles all WebSocket communication between VishMaker (frontend) and VishCoder (backend/AI agent).
 * It provides utilities for creating standardized payloads, validating responses, and managing communication state.
 * 
 * NEW FEATURES FOR NESTED STATUS DETAILS:
 * 
 * 1. Enhanced StatusDetails Interface:
 *    - Supports nested objects in statusDetails
 *    - Details field can be either a string OR an object
 *    - File update details with file_type, file_name, file_size
 *    - Agent and LLM information
 *    - Progress tracking
 *    - Extensible for custom fields
 * 
 * 2. Utility Methods:
 *    - extractFileUpdateDetails() - Extract file update information
 *    - extractAgentInfo() - Get agent and LLM details
 *    - extractProgress() - Get progress value
 *    - hasFileUpdate() - Check if file update exists
 *    - getStatusDetailsSummary() - Human-readable summary
 *    - convertStatusDetailsToChatMessage() - Convert to ChatMessage format
 * 
 * 3. Convenience Functions:
 *    - createFileUpdateStatusDetails() - Create file update status
 *    - createProgressStatusDetails() - Create progress status
 *    - createChatMessageFromStatusDetails() - Convert to chat message
 *    - Type guards for validation
 * 
 * EXAMPLE USAGE:
 * 
 * ```typescript
 * // Create file update status details (object details)
 * const fileStatus = createFileUpdateStatusDetails(
 *     "Manager", "AutoScripts", "New", "test_file.py", 14793
 * );
 * 
 * // Create string details status
 * const stringStatus: StatusDetails = {
 *     agent: "System",
 *     details: "Build process completed successfully"
 * };
 * 
 * // Extract file details
 * const fileDetails = commManager.extractFileUpdateDetails(fileStatus);
 * if (fileDetails) {
 *     console.log(`New file: ${fileDetails.file_name}`);
 * }
 * 
 * // Convert to chat message for VishCoderChat
 * const chatMessage = createChatMessageFromStatusDetails(fileStatus, 'manager');
 * ```
 */

// Type definitions for better type safety
export type VishMakerActor = "System" | "User";
export type VishCoderActor = "Coder";
export type Actor = VishMakerActor | VishCoderActor;

export type MessageType = "question_to_ai" | "build_feature" | "status_update" | "clarification_needed_from_user" | "heartbeat";
export type Status = "Initiated" | "InProgress" | "Completed" | "Failed" | "Error";

// Common status detail patterns
export interface FileUpdateDetails {
    file_type: "New" | "Modified";
    file_name: string;
    file_size: number | string;
}

export interface StatusDetails {
    agent?: string;
    LLM?: string;
    details?: string | FileUpdateDetails | Record<string, any>;
    progress?: number;
    [key: string]: any; // Allow for other custom fields
}

export interface Origin {
    /** Message origin and response tracking */
    originMessageId: string;
    originActor: Actor;
    respondingToMessageId: string | null;
    respondingToActor: Actor | null;
}

export interface MessagePayload {
    /** Payload for message-based communication (questions, clarifications, responses) */
    question_text?: string;
    response_text?: string;
    context?: string;
    clarification_needed?: boolean;
}

export interface ContractPayload {
    /** Payload for build feature contracts */
    metadata: Record<string, any>;
    settings: Record<string, any>;
    requirements: Record<string, any>;
    statusDetails: Record<string, any>;
}

export interface VishCoderPayload {
    /** Standardized payload structure for all communications */
    version: string;
    messageId: string;
    threadId: string;
    actor: Actor;
    type: MessageType;
    status: Status;
    timestamp: string;
    origin: Origin;
    body: {
        contract: Record<string, any>;
        messages: Record<string, any>;
        statusDetails: StatusDetails;
    };
}

export class CommunicationManager {
    /**
     * Manages communication state and provides utilities for creating and validating payloads
     */
    
    private sessionThreadId: string | null = null;
    private originMessageId: string | null = null;
    private originActor: Actor | null = null;
    
    setSessionThread(lowLevelRequirementId: string): string {
        /**
         * Set the thread ID for the current session based on Low Level Requirement ID
         * 
         * @param lowLevelRequirementId - The ID of the low level requirement
         * @returns The generated thread ID
         */
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
        this.sessionThreadId = `thread_${lowLevelRequirementId}_${timestamp}`;
        return this.sessionThreadId;
    }
    
    // Private helper methods for internal use
    private generateMessageId(): string {
        /** Generate a unique message ID */
        return `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
    }
    
    private getCurrentTimestamp(): string {
        /** Get current timestamp in ISO format */
        return new Date().toISOString();
    }
    
    createVishmakerPayload(
        messageType: MessageType,
        actor: VishMakerActor,
        payloadData: MessagePayload | ContractPayload,
        respondingToMessageId?: string,
        respondingToActor?: Actor
    ): VishCoderPayload {
        /**
         * Create a standardized payload from VishMaker
         * 
         * @param messageType - Type of message being sent
         * @param actor - Who is sending the message (System or User)
         * @param payloadData - The actual payload data
         * @param respondingToMessageId - ID of message being responded to (if applicable)
         * @param respondingToActor - Actor of message being responded to (if applicable)
         * 
         * @returns Standardized VishCoderPayload
         */
        if (!this.sessionThreadId) {
            throw new Error("Session thread ID not set. Call setSessionThread() first.");
        }
        
        const messageId = this.generateMessageId();
        const timestamp = this.getCurrentTimestamp();
        
        // Set origin message if this is the first message in the thread
        if (!this.originMessageId) {
            this.originMessageId = messageId;
            this.originActor = actor;
        }
        
        const origin: Origin = {
            originMessageId: this.originMessageId!,
            originActor: this.originActor!,
            respondingToMessageId: respondingToMessageId || null,
            respondingToActor: respondingToActor || null
        };
        
        // Determine body structure based on message type
        let body: VishCoderPayload['body'];
        if (messageType === "build_feature") {
            if (!this.isContractPayload(payloadData)) {
                throw new Error("build_feature requires ContractPayload");
            }
            body = {
                contract: payloadData,
                messages: {},
                statusDetails: {}
            };
        } else {
            if (!this.isMessagePayload(payloadData)) {
                throw new Error(`${messageType} requires MessagePayload`);
            }
            body = {
                messages: payloadData,
                contract: {},
                statusDetails: {}
            };
        }

        // Determine status based on message type and context
        let status: Status;
        if (messageType === "build_feature" || messageType === "question_to_ai") {
            status = "Initiated"; // Initial requests from VishMaker
        } else if (messageType === "clarification_needed_from_user") {
            if (respondingToMessageId) {
                status = "InProgress"; // User responding to clarification request
            } else {
                status = "Initiated"; // Initial clarification request
            }
        } else if (messageType === "status_update") {
            status = "Completed"; // Status updates indicate completion
        } else {
            status = "Initiated"; // Default for other message types
        }

        const finalPayload: VishCoderPayload = {
            version: "1.0",
            messageId: messageId,
            threadId: this.sessionThreadId,
            actor: actor,
            type: messageType,
            status: status,
            timestamp: timestamp,
            origin: origin,
            body: body
        };
        
        console.log(`🔄 Creating VishCoderPayload (${status}):`, JSON.stringify(finalPayload, null, 2));

        return finalPayload;
    }
    
    createQuestionPayload(
        questionText: string,
        context?: string,
        respondingToMessageId?: string,
        respondingToActor?: Actor
    ): VishCoderPayload {
        /**
         * Create a question_to_ai payload
         * 
         * @param questionText - The question being asked
         * @param context - Optional context for the question
         * @param respondingToMessageId - ID of message being responded to (if applicable)
         * @param respondingToActor - Actor of message being responded to (if applicable)
         * 
         * @returns Standardized VishCoderPayload for question_to_ai
         */
        const messagePayload: MessagePayload = {
            question_text: questionText,
            response_text: undefined,
            context: context
        };
        
        return this.createVishmakerPayload(
            "question_to_ai",
            "User",
            messagePayload,
            respondingToMessageId,
            respondingToActor
        );
    }
    
    createBuildFeaturePayload(
        contractData: ContractPayload,
        respondingToMessageId?: string,
        respondingToActor?: Actor
    ): VishCoderPayload {
        /**
         * Create a build_feature payload
         * 
         * @param contractData - The contract data for the feature
         * @param respondingToMessageId - ID of message being responded to (if applicable)
         * @param respondingToActor - Actor of message being responded to (if applicable)
         * 
         * @returns Standardized VishCoderPayload for build_feature
         */
        return this.createVishmakerPayload(
            "build_feature",
            "System",
            contractData,
            respondingToMessageId,
            respondingToActor
        );
    }
    
    createClarificationResponse(
        clarificationText: string,
        respondingToMessageId: string,
        respondingToActor: Actor
    ): VishCoderPayload {
        /**
         * Create a response to a clarification request from VishCoder
         * 
         * @param clarificationText - The user's response to the clarification
         * @param respondingToMessageId - ID of the clarification message being responded to
         * @param respondingToActor - Actor of the clarification message (should be "Coder")
         * 
         * @returns Standardized VishCoderPayload for clarification response
         */
        const messagePayload: MessagePayload = {
            question_text: undefined,
            response_text: clarificationText,
            context: "User response to clarification request",
            clarification_needed: false
        };
        
        return this.createVishmakerPayload(
            "clarification_needed_from_user",
            "User",
            messagePayload,
            respondingToMessageId,
            respondingToActor
        );
    }
    
    markMessageCompleted(
        messageType: MessageType,
        respondingToMessageId: string,
        respondingToActor: Actor,
        completionData?: any
    ): VishCoderPayload {
        /**
         * Mark a message as completed (e.g., when user responds to clarification)
         * 
         * @param messageType - Type of message being completed
         * @param respondingToMessageId - ID of the message being completed
         * @param respondingToActor - Actor of the message being completed
         * @param completionData - Optional data to include in the completion
         * 
         * @returns Standardized VishCoderPayload with "Completed" status
         */
        const messagePayload: MessagePayload = {
            question_text: undefined,
            response_text: completionData?.response || "Request completed",
            context: completionData?.context || "Message marked as completed",
            clarification_needed: false
        };
        
        // Create payload with "Completed" status
        const payload = this.createVishmakerPayload(
            messageType,
            "User",
            messagePayload,
            respondingToMessageId,
            respondingToActor
        );
        
        // Override status to "Completed"
        payload.status = "Completed";
        
        return payload;
    }
    
    validateResponse(responseData: Record<string, any>): [boolean, string | null] {
        /**
         * Validate incoming response from VishCoder
         * 
         * @param responseData - Raw response data from WebSocket
         * 
         * @returns Tuple of [isValid, errorMessage]
         */
        try {
            // Check required fields
            const requiredFields = [
                "version", "messageId", "threadId", "actor", "type", 
                "status", "timestamp", "origin", "body"
            ];
            
            for (const field of requiredFields) {
                if (!(field in responseData)) {
                    return [false, `Missing required field: ${field}`];
                }
            }
            
            // Validate actor
            if (!["System", "User", "Coder"].includes(responseData["actor"])) {
                return [false, `Invalid actor: ${responseData["actor"]}`];
            }
            
            // Validate type
            const validTypes = ["question_to_ai", "build_feature", "status_update", "clarification_needed_from_user", "heartbeat"];
            if (!validTypes.includes(responseData["type"])) {
                return [false, `Invalid message type: ${responseData["type"]}`];
            }
            
            // Validate status
            const validStatuses = ["Initiated", "InProgress", "Completed", "Failed", "Error"];
            if (!validStatuses.includes(responseData["status"])) {
                return [false, `Invalid status: ${responseData["status"]}`];
            }
            
            // Validate origin structure
            const origin = responseData["origin"];
            if (typeof origin !== "object" || origin === null) {
                return [false, "Origin must be an object"];
            }
            
            const originFields = ["originMessageId", "originActor", "respondingToMessageId", "respondingToActor"];
            for (const field of originFields) {
                if (!(field in origin)) {
                    return [false, `Missing origin field: ${field}`];
                }
            }
            
            // Validate body structure
            const body = responseData["body"];
            if (typeof body !== "object" || body === null) {
                return [false, "Body must be an object"];
            }
            
            // Check if body has the required structure
            if (!("contract" in body) || !("messages" in body)) {
                return [false, "Body must contain 'contract' and 'messages'"];
            }
            
            // statusDetails is optional and can come from root level
            
            return [true, null];
            
        } catch (error) {
            return [false, `Validation error: ${error instanceof Error ? error.message : String(error)}`];
        }
    }
    
    parseResponse(responseData: Record<string, any>): VishCoderPayload | null {
        /**
         * Parse and validate response data into a VishCoderPayload object
         * 
         * @param responseData - Raw response data from WebSocket
         * 
         * @returns Parsed VishCoderPayload or null if invalid
         */
        // Log the raw response from VishCoder
        console.log(`📥 Received Response from VishCoder (${responseData.status || 'Unknown'}):`, JSON.stringify(responseData, null, 2));
        
        const [isValid, errorMessage] = this.validateResponse(responseData);
        
        if (!isValid) {
            console.error(`❌ Invalid response: ${errorMessage}`);
            console.error(`📋 Raw response data:`, JSON.stringify(responseData, null, 2));
            return null;
        }
        
        try {
            // Parse origin
            const originData = responseData["origin"];
            const origin: Origin = {
                originMessageId: originData["originMessageId"],
                originActor: originData["originActor"],
                respondingToMessageId: originData["respondingToMessageId"],
                respondingToActor: originData["respondingToActor"]
            };
            
            // Parse body based on type
            const bodyData = responseData["body"];
            
            // Extract status_details from root level if it exists
            const rootStatusDetails = responseData["status_details"] || responseData["statusDetails"];
            
            // Log where status details are found
            if (rootStatusDetails) {
                console.log(`🔍 Found status details in root:`, JSON.stringify(rootStatusDetails, null, 2));
            } else if (bodyData.statusDetails) {
                console.log(`🔍 Found status details in body:`, JSON.stringify(bodyData.statusDetails, null, 2));
            } else {
                console.log(`🔍 No status details found in response`);
            }
            
            // Always create the standardized body structure
            const body = {
                contract: bodyData.contract || {},
                messages: bodyData.messages || {},
                statusDetails: (rootStatusDetails || bodyData.statusDetails || {}) as StatusDetails
            };
            
            const parsedPayload = {
                version: responseData["version"],
                messageId: responseData["messageId"],
                threadId: responseData["threadId"],
                actor: responseData["actor"],
                type: responseData["type"],
                status: responseData["status"],
                timestamp: responseData["timestamp"],
                origin: origin,
                body: body
            };
            
            // Log the parsed and validated response
            console.log(`✅ Parsed Response from VishCoder (${parsedPayload.status}):`, JSON.stringify(parsedPayload, null, 2));
            
            // Log status details if available with better formatting
            if (parsedPayload.body.statusDetails && Object.keys(parsedPayload.body.statusDetails).length > 0) {
                console.log(`📊 Status Details:`, JSON.stringify(parsedPayload.body.statusDetails, null, 2));
                
                // Extract and log specific information if available
                const fileDetails = this.extractFileUpdateDetails(parsedPayload.body.statusDetails);
                if (fileDetails) {
                    console.log(`📄 File Update: ${fileDetails.file_type} file "${fileDetails.file_name}" (${fileDetails.file_size} bytes)`);
                }
                
                const agentInfo = this.extractAgentInfo(parsedPayload.body.statusDetails);
                if (agentInfo.agent || agentInfo.llm) {
                    console.log(`🤖 Agent: ${agentInfo.agent || 'Unknown'} | LLM: ${agentInfo.llm || 'Unknown'}`);
                }
                
                const progress = this.extractProgress(parsedPayload.body.statusDetails);
                if (progress !== undefined) {
                    console.log(`📈 Progress: ${progress}%`);
                }
            }
            
            return parsedPayload;
            
        } catch (error) {
            console.error(`Error parsing response: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    
    // Utility methods for working with status details
    extractFileUpdateDetails(statusDetails: StatusDetails): FileUpdateDetails | null {
        /**
         * Extract file update details from status details if they exist
         * 
         * @param statusDetails - The status details object
         * @returns FileUpdateDetails object or null if not found
         */
        if (statusDetails?.details && typeof statusDetails.details === 'object') {
            const details = statusDetails.details as any;
            if (details.file_type && details.file_name && details.file_size !== undefined) {
                return {
                    file_type: details.file_type,
                    file_name: details.file_name,
                    file_size: details.file_size
                };
            }
        }
        return null;
    }
    
    extractAgentInfo(statusDetails: StatusDetails): { agent?: string; llm?: string } {
        /**
         * Extract agent and LLM information from status details
         * 
         * @param statusDetails - The status details object
         * @returns Object with agent and llm properties
         */
        return {
            agent: statusDetails?.agent,
            llm: statusDetails?.LLM || statusDetails?.llm
        };
    }
    
    extractProgress(statusDetails: StatusDetails): number | undefined {
        /**
         * Extract progress value from status details
         * 
         * @param statusDetails - The status details object
         * @returns Progress number or undefined if not found
         */
        return statusDetails?.progress;
    }
    
    hasFileUpdate(statusDetails: StatusDetails): boolean {
        /**
         * Check if status details contain file update information
         * 
         * @param statusDetails - The status details object
         * @returns True if file update details are present
         */
        return this.extractFileUpdateDetails(statusDetails) !== null;
    }
    
    getStatusDetailsSummary(statusDetails: StatusDetails): string {
        /**
         * Get a human-readable summary of status details
         * 
         * @param statusDetails - The status details object
         * @returns Summary string
         */
        const parts: string[] = [];
        
        if (statusDetails.agent) {
            parts.push(`Agent: ${statusDetails.agent}`);
        }
        
        if (statusDetails.LLM || statusDetails.llm) {
            parts.push(`LLM: ${statusDetails.LLM || statusDetails.llm}`);
        }
        
        if (statusDetails.progress !== undefined) {
            parts.push(`Progress: ${statusDetails.progress}%`);
        }
        
        // Handle details field - could be string or object
        if (typeof statusDetails.details === 'string') {
            parts.push(`Details: ${statusDetails.details}`);
        } else if (statusDetails.details && typeof statusDetails.details === 'object') {
            const fileDetails = this.extractFileUpdateDetails(statusDetails);
            if (fileDetails) {
                parts.push(`File: ${fileDetails.file_name} (${fileDetails.file_type})`);
            }
        }
        
        return parts.length > 0 ? parts.join(' • ') : 'No details available';
    }
    
    convertStatusDetailsToChatMessage(
        statusDetails: StatusDetails,
        messageId: string,
        timestamp: Date,
        messageType: 'manager' | 'developer' | 'system' = 'developer'
    ): any {
        /**
         * Convert status details to a ChatMessage format for VishCoderChat
         * 
         * @param statusDetails - The status details object
         * @param messageId - Unique message ID
         * @param timestamp - Message timestamp
         * @param messageType - Type of message (default: developer)
         * @returns ChatMessage object
         */
        const agentInfo = this.extractAgentInfo(statusDetails);
        const fileDetails = this.extractFileUpdateDetails(statusDetails);
        const progress = this.extractProgress(statusDetails);
        
        // If this is a file update, create a special message format
        if (fileDetails) {
            return {
                id: messageId,
                type: messageType,
                content: `File update notification`,
                timestamp: timestamp,
                agent: agentInfo.agent,
                llm: agentInfo.llm,
                details: {
                    file_type: fileDetails.file_type,
                    file_name: fileDetails.file_name,
                    file_size: typeof fileDetails.file_size === 'number' 
                        ? `${fileDetails.file_size} bytes`
                        : fileDetails.file_size
                }
            };
        }
        
        // If details is a string, use it as content
        if (typeof statusDetails.details === 'string') {
            return {
                id: messageId,
                type: messageType,
                content: statusDetails.details,
                timestamp: timestamp,
                agent: agentInfo.agent,
                llm: agentInfo.llm,
                progress: progress
            };
        }
        
        // Regular status message
        return {
            id: messageId,
            type: messageType,
            content: this.getStatusDetailsSummary(statusDetails),
            timestamp: timestamp,
            agent: agentInfo.agent,
            llm: agentInfo.llm,
            progress: progress
        };
    }
    

    

    
    // Type guards
    private isContractPayload(data: any): data is ContractPayload {
        return data && typeof data === "object" && "metadata" in data && "settings" in data && "requirements" in data;
    }
    
    private isMessagePayload(data: any): data is MessagePayload {
        return data && typeof data === "object" && ("question_text" in data || "response_text" in data);
    }
}

// Convenience functions for common operations
export function createContractPayload(
    metadata: Record<string, any>,
    settings: Record<string, any>,
    requirements: Record<string, any>,
    statusDetails: Record<string, any>
): ContractPayload {
    /** Create a contract payload with the given data */
    const payload = {
        metadata,
        settings,
        requirements,
        statusDetails
    };
    
    console.log(`📋 Created ContractPayload:`, JSON.stringify(payload, null, 2));
    return payload;
}

export function createMessagePayload(
    questionText: string,
    responseText?: string,
    context?: string,
    clarificationNeeded?: boolean
): MessagePayload {
    /** Create a message payload with the given data */
    const payload = {
        question_text: questionText,
        response_text: responseText,
        context: context,
        clarification_needed: clarificationNeeded
    };
    
    console.log(`💬 Created MessagePayload:`, JSON.stringify(payload, null, 2));
    return payload;
}

// Convenience functions for working with status details
export function createFileUpdateStatusDetails(
    agent: string,
    llm: string,
    fileType: "New" | "Modified",
    fileName: string,
    fileSize: number | string,
    additionalDetails?: Record<string, any>
): StatusDetails {
    /** Create status details for file updates */
    const statusDetails: StatusDetails = {
        agent,
        LLM: llm,
        details: {
            file_type: fileType,
            file_name: fileName,
            file_size: fileSize
        },
        ...additionalDetails
    };
    
    console.log(`📄 Created FileUpdate StatusDetails:`, JSON.stringify(statusDetails, null, 2));
    return statusDetails;
}

export function createProgressStatusDetails(
    agent: string,
    llm: string,
    progress: number,
    additionalDetails?: Record<string, any>
): StatusDetails {
    /** Create status details with progress information */
    const statusDetails: StatusDetails = {
        agent,
        LLM: llm,
        progress,
        ...additionalDetails
    };
    
    console.log(`📊 Created Progress StatusDetails:`, JSON.stringify(statusDetails, null, 2));
    return statusDetails;
}

export function isFileUpdateStatusDetails(statusDetails: any): statusDetails is StatusDetails {
    /** Type guard to check if status details contain file update information */
    return statusDetails && 
           typeof statusDetails === 'object' && 
           statusDetails.details && 
           typeof statusDetails.details === 'object' &&
           'file_type' in statusDetails.details &&
           'file_name' in statusDetails.details &&
           'file_size' in statusDetails.details;
}

export function isProgressStatusDetails(statusDetails: any): statusDetails is StatusDetails {
    /** Type guard to check if status details contain progress information */
    return statusDetails && 
           typeof statusDetails === 'object' && 
           typeof statusDetails.progress === 'number';
}

export function isStringDetailsStatusDetails(statusDetails: any): statusDetails is StatusDetails {
    /** Type guard to check if status details contain string details */
    return statusDetails && 
           typeof statusDetails === 'object' && 
           typeof statusDetails.details === 'string';
}

// Convenience function to create ChatMessage from status details
export function createChatMessageFromStatusDetails(
    statusDetails: StatusDetails,
    messageType: 'manager' | 'developer' | 'system' = 'developer'
): any {
    /**
     * Create a ChatMessage object from status details for use in VishCoderChat
     * 
     * @param statusDetails - The status details object
     * @param messageType - Type of message (default: developer)
     * @returns ChatMessage object
     */
    const messageId = `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const timestamp = new Date();
    
    return commManager.convertStatusDetailsToChatMessage(
        statusDetails,
        messageId,
        timestamp,
        messageType
    );
}


// Global communication manager instance
export const commManager = new CommunicationManager();

// Example usage of the new nested status details functionality
export function demonstrateNestedStatusDetails() {
    console.log('🚀 Demonstrating Nested Status Details Functionality');
    
    // Example 1: File Update Status Details (object details)
    const fileStatus = createFileUpdateStatusDetails(
        "Manager",
        "AutoScripts", 
        "New",
        "test_password_validation_core.py",
        14793
    );
    
    console.log('📄 File Update Status:', JSON.stringify(fileStatus, null, 2));
    
    // Extract file details
    const fileDetails = commManager.extractFileUpdateDetails(fileStatus);
    if (fileDetails) {
        console.log(`✅ Extracted: ${fileDetails.file_type} file "${fileDetails.file_name}" (${fileDetails.file_size} bytes)`);
    }
    
    // Example 2: String Details Status
    const stringDetailsStatus: StatusDetails = {
        agent: "System",
        LLM: "GPT-4",
        details: "Build process completed successfully",
        progress: 100
    };
    
    console.log('📝 String Details Status:', JSON.stringify(stringDetailsStatus, null, 2));
    
    // Example 3: Progress Status Details
    const progressStatus = createProgressStatusDetails(
        "Developer",
        "Claude 3.5 Sonnet",
        75,
        { stage: "Testing", tests_passed: 15, tests_total: 20 }
    );
    
    console.log('📊 Progress Status:', JSON.stringify(progressStatus, null, 2));
    
    // Extract progress
    const progress = commManager.extractProgress(progressStatus);
    console.log(`📈 Progress: ${progress}%`);
    
    // Example 4: Convert to Chat Message
    const chatMessage = createChatMessageFromStatusDetails(fileStatus, 'manager');
    console.log('💬 Chat Message:', JSON.stringify(chatMessage, null, 2));
    
    // Example 5: Status Summary
    const fileSummary = commManager.getStatusDetailsSummary(fileStatus);
    console.log(`📋 File Status Summary: ${fileSummary}`);
    
    const stringSummary = commManager.getStatusDetailsSummary(stringDetailsStatus);
    console.log(`📋 String Details Summary: ${stringSummary}`);
    
    console.log('✨ Nested Status Details Demo Complete!');
}

// Note: Types are already exported at the top of the file
