"""
Communication Protocol Handler for VishMaker ↔ VishCoder

This module handles all WebSocket communication between VishMaker (frontend) and VishCoder (backend/AI agent).
It provides utilities for creating standardized payloads, validating responses, and managing communication state.
"""

import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, Union, Literal
from dataclasses import dataclass, asdict

# Type definitions for better type safety
VishMakerActor = Literal["System", "User"]
VishCoderActor = Literal["Coder"]
Actor = Union[VishMakerActor, VishCoderActor]

MessageType = Literal["question_to_ai", "build_feature", "heartbeat"]
Status = Literal["Initiated", "InProgress", "Completed", "Failed", "Error"]

@dataclass
class Origin:
    """Message origin and response tracking"""
    originMessageId: str
    originActor: Actor
    respondingToMessageId: Optional[str]
    respondingToActor: Optional[Actor]

@dataclass
class MessagePayload:
    """Payload for message-based communication (questions, clarifications, responses)"""
    question_text: Optional[str]
    response_text: Optional[str]
    context: Optional[str] = None
    clarification_needed: Optional[bool] = None

@dataclass
class ContractPayload:
    """Payload for build feature contracts"""
    metadata: Dict[str, Any]
    settings: Dict[str, Any]
    requirements: Dict[str, Any]
    statusDetails: Dict[str, Any]

@dataclass
class VishCoderPayload:
    """Standardized payload structure for all communications"""
    version: str
    messageId: str
    threadId: str
    actor: Actor
    type: MessageType
    status: Status
    timestamp: str
    origin: Origin
    body: Dict[str, Any]  # Contains contract, messages, statusDetails

class CommunicationManager:
    """
    Manages communication state and provides utilities for creating and validating payloads
    """
    
    def __init__(self):
        self.session_thread_id: Optional[str] = None
        self.origin_message_id: Optional[str] = None
        self.origin_actor: Optional[Actor] = None
        
    def set_session_thread(self, low_level_requirement_id: str) -> str:
        """
        Set the thread ID for the current session based on Low Level Requirement ID
        
        Args:
            low_level_requirement_id: The ID of the low level requirement
            
        Returns:
            The generated thread ID
        """
        self.session_thread_id = f"thread_{low_level_requirement_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        return self.session_thread_id
    
    def get_session_thread(self) -> Optional[str]:
        """Get the current session thread ID"""
        return self.session_thread_id
    
    def set_origin_message(self, message_id: str, actor: Actor) -> None:
        """
        Set the origin message for the current thread
        
        Args:
            message_id: The ID of the first message in the thread
            actor: The actor who initiated the thread
        """
        self.origin_message_id = message_id
        self.origin_actor = actor
    
    def get_origin_message(self) -> tuple[Optional[str], Optional[Actor]]:
        """Get the origin message ID and actor"""
        return self.origin_message_id, self.origin_actor
    
    def generate_message_id(self) -> str:
        """Generate a unique message ID"""
        return f"msg_{uuid.uuid4().hex[:8]}"
    
    def get_current_timestamp(self) -> str:
        """Get current timestamp in ISO format"""
        return datetime.now().isoformat() + "Z"
    
    def create_vishmaker_payload(
        self,
        message_type: MessageType,
        actor: VishMakerActor,
        payload_data: Union[MessagePayload, ContractPayload],
        responding_to_message_id: Optional[str] = None,
        responding_to_actor: Optional[Actor] = None
    ) -> VishCoderPayload:
        """
        Create a standardized payload from VishMaker
        
        Args:
            message_type: Type of message being sent
            actor: Who is sending the message (System or User)
            payload_data: The actual payload data
            responding_to_message_id: ID of message being responded to (if applicable)
            responding_to_actor: Actor of message being responded to (if applicable)
            
        Returns:
            Standardized VishCoderPayload
        """
        if not self.session_thread_id:
            raise ValueError("Session thread ID not set. Call set_session_thread() first.")
        
        message_id = self.generate_message_id()
        timestamp = self.get_current_timestamp()
        
        # Set origin message if this is the first message in the thread
        if not self.origin_message_id:
            self.set_origin_message(message_id, actor)
        
        origin = Origin(
            originMessageId=self.origin_message_id,
            originActor=self.origin_actor,
            respondingToMessageId=responding_to_message_id,
            respondingToActor=responding_to_actor
        )
        
        # Determine body structure based on message type
        if message_type == "build_feature":
            if not isinstance(payload_data, ContractPayload):
                raise ValueError("build_feature requires ContractPayload")
            body = {
                "contract": asdict(payload_data),
                "messages": {},
                "statusDetails": {}
            }
        else:
            if not isinstance(payload_data, MessagePayload):
                raise ValueError(f"{message_type} requires MessagePayload")
            body = {
                "messages": asdict(payload_data),
                "contract": {},
                "statusDetails": {}
            }
        
        return VishCoderPayload(
            version="1.0",
            messageId=message_id,
            threadId=self.session_thread_id,
            actor=actor,
            type=message_type,
            status="Initiated",  # VishMaker always sends "Initiated"
            timestamp=timestamp,
            origin=origin,
            body=body
        )
    
    def create_question_payload(
        self,
        question_text: str,
        context: Optional[str] = None,
        responding_to_message_id: Optional[str] = None,
        responding_to_actor: Optional[Actor] = None
    ) -> VishCoderPayload:
        """
        Create a question_to_ai payload
        
        Args:
            question_text: The question being asked
            context: Optional context for the question
            responding_to_message_id: ID of message being responded to (if applicable)
            responding_to_actor: Actor of message being responded to (if applicable)
            
        Returns:
            Standardized VishCoderPayload for question_to_ai
        """
        message_payload = MessagePayload(
            question_text=question_text,
            response_text=None,
            context=context
        )
        
        return self.create_vishmaker_payload(
            message_type="question_to_ai",
            actor="User",
            payload_data=message_payload,
            responding_to_message_id=responding_to_message_id,
            responding_to_actor=responding_to_actor
        )
    
    def create_build_feature_payload(
        self,
        contract_data: ContractPayload,
        responding_to_message_id: Optional[str] = None,
        responding_to_actor: Optional[Actor] = None
    ) -> VishCoderPayload:
        """
        Create a build_feature payload
        
        Args:
            contract_data: The contract data for the feature
            responding_to_message_id: ID of message being responded to (if applicable)
            responding_to_actor: Actor of message being responded to (if applicable)
            
        Returns:
            Standardized VishCoderPayload for build_feature
        """
        return self.create_vishmaker_payload(
            message_type="build_feature",
            actor="System",
            payload_data=contract_data,
            responding_to_message_id=responding_to_message_id,
            responding_to_actor=responding_to_actor
        )
    
    def create_heartbeat_payload(self) -> VishCoderPayload:
        """
        Create a heartbeat payload to maintain connection
        
        Returns:
            Standardized VishCoderPayload for heartbeat
        """
        if not self.session_thread_id:
            raise ValueError("Session thread ID not set. Call set_session_thread() first.")
        
        message_id = self.generate_message_id()
        timestamp = self.get_current_timestamp()
        
        # Heartbeat doesn't need complex origin tracking
        origin = Origin(
            originMessageId=self.origin_message_id or message_id,
            originActor=self.origin_actor or "System",
            respondingToMessageId=None,
            respondingToActor=None
        )
        
        return VishCoderPayload(
            version="1.0",
            messageId=message_id,
            threadId=self.session_thread_id,
            actor="System",
            type="heartbeat",
            status="Initiated",
            timestamp=timestamp,
            origin=origin,
            body={
                "messages": {"question_text": "heartbeat", "response_text": None},
                "contract": {},
                "statusDetails": {}
            }
        )
    
    def validate_response(self, response_data: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """
        Validate incoming response from VishCoder
        
        Args:
            response_data: Raw response data from WebSocket
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            # Check required fields
            required_fields = [
                "version", "messageId", "threadId", "actor", "type", 
                "status", "timestamp", "origin", "body"
            ]
            
            for field in required_fields:
                if field not in response_data:
                    return False, f"Missing required field: {field}"
            
            # Validate actor
            if response_data["actor"] not in ["System", "User", "Coder"]:
                return False, f"Invalid actor: {response_data['actor']}"
            
            # Validate type
            valid_types = ["question_to_ai", "build_feature", "heartbeat", "status_update", "clarification_needed_from_user"]
            if response_data["type"] not in valid_types:
                return False, f"Invalid message type: {response_data['type']}"
            
            # Validate status
            valid_statuses = ["Initiated", "InProgress", "Completed", "Failed", "Error"]
            if response_data["status"] not in valid_statuses:
                return False, f"Invalid status: {response_data['status']}"
            
            # Validate origin structure
            origin = response_data["origin"]
            if not isinstance(origin, dict):
                return False, "Origin must be an object"
            
            origin_fields = ["originMessageId", "originActor", "respondingToMessageId", "respondingToActor"]
            for field in origin_fields:
                if field not in origin:
                    return False, f"Missing origin field: {field}"
            
            # Validate body structure
            body = response_data["body"]
            if not isinstance(body, dict):
                return False, "Body must be an object"
            
            # Check if body has the required structure
            if "contract" not in body or "messages" not in body or "statusDetails" not in body:
                return False, "Body must contain 'contract', 'messages', and 'statusDetails'"
            
            return True, None
            
        except Exception as e:
            return False, f"Validation error: {str(e)}"
    
    def parse_response(self, response_data: Dict[str, Any]) -> Optional[VishCoderPayload]:
        """
        Parse and validate response data into a VishCoderPayload object
        
        Args:
            response_data: Raw response data from WebSocket
            
        Returns:
            Parsed VishCoderPayload or None if invalid
        """
        is_valid, error_message = self.validate_response(response_data)
        
        if not is_valid:
            print(f"Invalid response: {error_message}")
            return None
        
        try:
            # Parse origin
            origin_data = response_data["origin"]
            origin = Origin(
                originMessageId=origin_data["originMessageId"],
                originActor=origin_data["originActor"],
                respondingToMessageId=origin_data["respondingToMessageId"],
                respondingToActor=origin_data["respondingToActor"]
            )
            
            # Parse body based on type
            body_data = response_data["body"]
            
            # Always create the standardized body structure
            body = {
                "contract": body_data.get("contract", {}),
                "messages": body_data.get("messages", {}),
                "statusDetails": body_data.get("statusDetails", {})
            }
            
            return VishCoderPayload(
                version=response_data["version"],
                messageId=response_data["messageId"],
                threadId=response_data["threadId"],
                actor=response_data["actor"],
                type=response_data["type"],
                status=response_data["status"],
                timestamp=response_data["timestamp"],
                origin=origin,
                body=body
            )
            
        except Exception as e:
            print(f"Error parsing response: {str(e)}")
            return None
    
    def get_response_summary(self, response: VishCoderPayload) -> str:
        """
        Get a human-readable summary of the response
        
        Args:
            response: Parsed response payload
            
        Returns:
            Summary string
        """
        summary_parts = [
            f"From: {response.actor}",
            f"Type: {response.type}",
            f"Status: {response.status}",
            f"Time: {response.timestamp}"
        ]
        
        if response.origin.respondingToMessageId:
            summary_parts.append(f"Responding to: {response.origin.respondingToMessageId}")
        
        return " | ".join(summary_parts)
    
    def to_json(self, payload: VishCoderPayload) -> str:
        """
        Convert payload to JSON string
        
        Args:
            payload: VishCoderPayload to serialize
            
        Returns:
            JSON string
        """
        return json.dumps(asdict(payload), indent=2)
    
    def from_json(self, json_string: str) -> Optional[VishCoderPayload]:
        """
        Parse JSON string into VishCoderPayload
        
        Args:
            json_string: JSON string to parse
            
        Returns:
            Parsed VishCoderPayload or None if invalid
        """
        try:
            data = json.loads(json_string)
            return self.parse_response(data)
        except Exception as e:
            print(f"Error parsing JSON: {str(e)}")
            return None

# Convenience functions for common operations
def create_contract_payload(
    metadata: Dict[str, Any],
    settings: Dict[str, Any],
    requirements: Dict[str, Any],
    status_details: Dict[str, Any]
) -> ContractPayload:
    """Create a contract payload with the given data"""
    return ContractPayload(
        metadata=metadata,
        settings=settings,
        requirements=requirements,
        statusDetails=status_details
    )

def create_message_payload(
    question_text: str,
    response_text: Optional[str] = None,
    context: Optional[str] = None,
    clarification_needed: Optional[str] = None
) -> MessagePayload:
    """Create a message payload with the given data"""
    return MessagePayload(
        question_text=question_text,
        response_text=response_text,
        context=context,
        clarification_needed=clarification_needed
    )

def create_vishcoder_body(
    contract: Optional[Dict[str, Any]] = None,
    messages: Optional[Dict[str, Any]] = None,
    status_details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create a standardized body structure for VishCoder messages"""
    return {
        "contract": contract or {},
        "messages": messages or {},
        "statusDetails": status_details or {}
    }

# Global communication manager instance
comm_manager = CommunicationManager()

# Export commonly used functions
__all__ = [
    'CommunicationManager',
    'VishCoderPayload',
    'ContractPayload',
    'MessagePayload',
    'Origin',
    'create_contract_payload',
    'create_message_payload',
    'create_vishcoder_body',
    'comm_manager'
]
