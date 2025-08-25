// Type definitions for better type safety
export const ACTORS = ["System", "User", "Coder"] as const;
export const MESSAGE_TYPES = ["question_to_ai", "build_feature", "status_update", "clarification_needed_from_user", "heartbeat"] as const;
export const STATUSES = ["Initiated", "InProgress", "Completed", "Failed", "Error", "Alive"] as const;

// Internal types (not exported since they're only used internally)
type VishMakerActor = typeof ACTORS[0] | typeof ACTORS[1];
type Actor = typeof ACTORS[number];
type MessageType = typeof MESSAGE_TYPES[number];
type Status = typeof STATUSES[number];

// Internal interfaces (not exported since they're only used internally)
interface FileUpdateDetails {
    file_type: "New" | "Modified";
    file_name: string;
    file_size: number | string;
}

interface StatusDetails {
    agent?: string;
    LLM?: string;
    details?: string;
    progress?: number;
    fileDetails?: FileUpdateDetails;
    [key: string]: any; // Allow for other custom fields
}

interface Origin {
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
            const body = {
                contract: bodyData.contract || {},
                messages: bodyData.messages || {},
                statusDetails: bodyData.statusDetails || {}
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
            
            return parsedPayload;
            
        } catch (error) {
            console.error(`Error parsing response: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    
    // Type guards
    private isContractPayload(data: any): data is ContractPayload {
        return data && typeof data === "object" && "metadata" in data && "settings" in data && "requirements" in data;
    }
    
    private isMessagePayload(data: any): data is MessagePayload {
        return data && typeof data === "object" && ("question_text" in data || "response_text" in data);
    }

    private validateResponse(responseData: Record<string, any>): [boolean, string | null] {
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
            
            // Validate actor using exported constants
            if (!ACTORS.includes(responseData["actor"])) {
                return [false, `Invalid actor: ${responseData["actor"]}`];
            }
            
            // Validate type using exported constants
            if (!MESSAGE_TYPES.includes(responseData["type"])) {
                return [false, `Invalid message type: ${responseData["type"]}`];
            }
            
            // Validate status using exported constants
            if (!STATUSES.includes(responseData["status"])) {
                return [false, `Invalid status: ${responseData["status"]}`];
            }
            
            // Validate origin structure
            const origin = responseData["origin"];
            if (typeof origin !== "object" || origin === null) {
                return [false, "Origin must be an object"];
            }
            
            // Validate body structure
            const body = responseData["body"];
            if (typeof body !== "object" || body === null) {
                return [false, "Body must be an object"];
            }
            
            // Check if body has the required structure
            if (!("contract" in body) || !("messages" in body) || !("statusDetails" in body)) {
                return [false, "Body must contain 'contract', or 'messages', or 'statusDetails'"];
            }
            
            return [true, null];
            
        } catch (error) {
            return [false, `Validation error: ${error instanceof Error ? error.message : String(error)}`];
        }
    }
}

// Convenience functions for common operations - only keeping the ones actually used
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

// Global communication manager instance
export const commManager = new CommunicationManager();
