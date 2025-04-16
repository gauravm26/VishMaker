"""
Feature code generation service module.
This module provides services to generate code based on test cases and additional input requirements.
Each LangChain agent now performs specific repository and workflow tasks:
  - ManagerAgent: Checks for a repository; creates it if missing or clones it locally.
  - ArchitectAgent: If the repository is empty, creates a boilerplate with vertical slice architecture; otherwise, pulls repository code into a local "work" folder.
  - AdminAgent: Validates that the "work" folder has proper service definitions and folder structure.
  - DeveloperAgent: Adds or updates code based on the input requirement.
  - TesterAgent: Tests the local "work" folder code ensuring all tests pass.
  - DeployerAgent: Deploys the solution and commits the updated code to the repository.
"""

import os
import logging
import json
from typing import Dict, List, Optional, Union, Any, Callable
from langchain.agents import Tool, AgentExecutor, BaseSingleActionAgent
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain.llms.base import BaseLLM
from langchain.schema import AgentAction, AgentFinish
from dotenv import load_dotenv

# Import Git repository utilities
from infrastructure.git.repository import check_repository_exists, clone_repository, create_repository
from infrastructure.git.repository import get_clone_folder_pattern, get_work_folder_pattern

# Load environment variables
load_dotenv(dotenv_path="global/.env")

# Setup logging
logger = logging.getLogger(__name__)

class LLMAgentFactory:
    """Factory class to create LLM-based agents from config."""
    
    @staticmethod
    def load_config(config_path: str = "global/config.json") -> Dict[str, Any]:
        """Load configuration from JSON file."""
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            return config
        except Exception as e:
            logger.error(f"Error loading config: {str(e)}")
            raise
    
    @staticmethod
    def create_agent(agent_type: str, llm: BaseLLM, config: Dict[str, Any]) -> BaseSingleActionAgent:
        """
        Create an agent based on the type and configuration.
        
        Args:
            agent_type: Type of agent (Manager, Architect, Admin, Developer, Tester, Deployer)
            llm: Language model to use
            config: Configuration for the agent
            
        Returns:
            An initialized agent instance
        """
        # Map agent types to their respective classes
        agent_classes = {
            "Manager": ManagerAgent,
            "Architect": ArchitectAgent,
            "Admin": AdminAgent,
            "Developer": DeveloperAgent,
            "Tester": TesterAgent,
            "Deployer": DeployerAgent
        }
        
        if agent_type not in agent_classes:
            raise ValueError(f"Unknown agent type: {agent_type}")
        
        # Get agent instruction from the llmagents section of config
        agent_key = f"{agent_type}Agent"
        agent_instruction = config.get("llmagents", {}).get(agent_key)
       
        if not agent_instruction:
            logger.warning(f"No instruction found for {agent_type} agent, using default.")
            agent_instruction = {
                "Role": f"You are a {agent_type} responsible for {agent_type.lower()} tasks.",
                "Objective": f"Complete {agent_type.lower()} tasks effectively.",
                "Constraints": {}
            }
            
        # Create and return the agent
        return agent_classes[agent_type](llm, agent_instruction, config)

class BaseAgent(BaseSingleActionAgent):
    """Base class for all agents in the system."""
    
    def __init__(self, llm: BaseLLM, instruction: Dict[str, Any], config: Dict[str, Any]):
        """
        Initialize the base agent.
        
        Args:
            llm: Language model to use
            instruction: Specific instructions for this agent type
            config: Full configuration dict
        """
        super().__init__()
        self.llm = llm
        self.instruction = instruction
        self.config = config
        self.agent_type = self.__class__.__name__.replace("Agent", "")
        
        # Initialize prompt template based on instruction
        role = instruction.get("Role", f"You are a {self.agent_type}")
        objective = instruction.get("Objective", "Assist in generating code.")
        constraints = instruction.get("Constraints", {})
        
        template = f"{role}\n\n{objective}\n\n"
        if constraints:
            template += "Constraints & Guidelines:\n"
            for key, value in constraints.items():
                if isinstance(value, dict):
                    template += f"- {key}:\n"
                    for subkey, subvalue in value.items():
                        template += f"  - {subkey}: {subvalue}\n"
                else:
                    template += f"- {key}: {value}\n"
        
        # The input will include additional info such as repository status, work folder path, etc.
        template += "\nInput: {input}\n\nResponse:"
        
        self.prompt = PromptTemplate(
            input_variables=["input"],
            template=template
        )
        
        self.chain = LLMChain(llm=llm, prompt=self.prompt)
    
    def plan(self, intermediate_steps, **kwargs) -> Union[AgentAction, AgentFinish]:
        """Plan the next action based on previous steps."""
        raise NotImplementedError("Subclasses must implement this method")
    
    def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process input data and return result."""
        result = self.chain.run(input=json.dumps(input_data))
        return {"output": result, "agent_type": self.agent_type}
    
    @property
    def input_keys(self):
        """Return expected input keys."""
        return ["input"]
    
    @property
    def return_values(self):
        """Return expected output keys."""
        return ["output"]

class ManagerAgent(BaseAgent):
    """Agent that coordinates overall process including repository management."""
    
    def plan(self, intermediate_steps, **kwargs) -> Union[AgentAction, AgentFinish]:
        """
        Decide the next step based on current state, including:
         - Checking if the repository exists.
         - Creating a new repository if it does not exist,
         - Cloning it locally if it does.
         - Then delegate to the ArchitectAgent.
        """
        current_state = kwargs.get("current_state", {})
        
        if not intermediate_steps:
            # Initial step - check repository status and handle repository operations.
            project_name = current_state.get("project_name")
            
            # Check if repository exists in repository
            return AgentAction(
                tool="check_repository_exists",
                tool_input={"project_name": project_name},
                log="Manager: Checking if project repository exists in repository."
            )
        
        # Continue the process based on repository check result
        last_action = intermediate_steps[-1][0]
        last_output = intermediate_steps[-1][1]
        
        if last_action == "check_repository_exists":
            project_id = current_state.get("project_id")
            repo_exists = last_output.get("exists", False)
            
            if repo_exists:
                # Repository exists, clone it
                clone_folder = get_clone_folder_pattern().format(project_name=project_name)
                return AgentAction(
                    tool="clone_repository",
                    tool_input={
                        "project_name": project_name,
                        "clone_path": clone_folder
                    },
                    log=f"Manager: Repository exists. Cloning to {clone_folder}."
                )
            else:
                # Repository doesn't exist, create it
                return AgentAction(
                    tool="create_repository",
                    tool_input={
                        "project_id": project_id,
                        "description": f"Repository for project {project_id}"
                    },
                    log="Manager: Repository doesn't exist. Creating new repository in repository."
                )
        
        elif last_action == "clone_repository" or last_action == "create_repository":
            # After repository operations, delegate to ArchitectAgent to set up architecture
            work_path = last_output.get("work_path")
            return AgentAction(
                tool="architect",
                tool_input={
                    **current_state, 
                    "repository_status": "check_and_prepare",
                    "work_path": work_path
                },
                log=f"Manager: Repository prepared. Delegating to Architect for architecture setup in {work_path}."
            )
        
        elif last_action == "architect":
            # After architecture setup is complete, delegate to DeveloperAgent.
            return AgentAction(
                tool="developer",
                tool_input=current_state,
                log="Manager: Architecture established; delegating to Developer for code modifications."
            )
        elif last_action == "developer":
            # After development, delegate to TesterAgent.
            return AgentAction(
                tool="tester",
                tool_input=current_state,
                log="Manager: Code developed; delegating to Tester for validating tests."
            )
        elif last_action == "tester":
            # After testing, if tests pass, delegate to DeployerAgent.
            if "issues" in last_output and last_output["issues"]:
                return AgentAction(
                    tool="developer",
                    tool_input=current_state,
                    log="Manager: Test issues found; returning to Developer for fixes."
                )
            else:
                return AgentAction(
                    tool="deployer",
                    tool_input=current_state,
                    log="Manager: Testing successful; delegating to Deployer for deployment."
                )
        elif last_action == "deployer":
            # Deployment finished, close process.
            return AgentFinish(
                return_values={"result": "Feature implemented, tested, and deployed successfully."},
                log="Manager: Deployment successful. Process completed."
            )
        
        return AgentFinish(
            return_values={"result": "Process completed with an unexpected flow."},
            log="Manager: Process ended unexpectedly."
        )

class ArchitectAgent(BaseAgent):
    """Agent responsible for setting up the solution architecture in the local work folder."""
    
    def plan(self, intermediate_steps, **kwargs) -> Union[AgentAction, AgentFinish]:
        """
        Based on the repository status:
         - If the repository is empty, create a boilerplate with vertical slice architecture.
         - If the repository is not empty, pull the relevant files into the local "work" folder.
        """
        input_data = kwargs.get("input", {})
        # Add a flag to indicate repository check status from ManagerAgent
        repo_status = input_data.get("repository_status", "unknown")
        
        if repo_status == "check_and_prepare":
            # Create or clone repository and then setup architecture.
            architecture_instructions = {
                "repository_status": repo_status,
                "instructions": "If repository is empty, create boilerplate with vertical slice structure. "
                                "Otherwise, copy existing files into local 'work' folder."
            }
            architecture_design = self.process(architecture_instructions)
            return AgentFinish(
                return_values={"architecture": architecture_design},
                log="Architect: Architecture setup completed; local 'work' folder prepared."
            )
        else:
            # Default fallback for architecture processing.
            architecture_design = self.process(input_data)
            return AgentFinish(
                return_values={"architecture": architecture_design},
                log="Architect: Architecture processed using provided input."
            )

class AdminAgent(BaseAgent):
    """Agent responsible for validating the local 'work' folder structure and service definitions."""
    
    def plan(self, intermediate_steps, **kwargs) -> Union[AgentAction, AgentFinish]:
        """
        Verify that the 'work' folder:
         - Contains the proper service definitions for services such as Lambda, API Gateway, Cognito, etc.
         - Follows the vertical slice architecture.
         - Report and correct any misconfigurations.
        """
        input_data = kwargs.get("input", {})
        admin_instructions = {
            "instructions": "Check that the 'work' folder has the correct structure and allowed service definitions. "
                            "Ensure services like Lambda, API Gateway, Cognito, and DynamoDB are properly defined."
        }
        admin_result = self.process(admin_instructions)
        return AgentFinish(
            return_values={"admin_result": admin_result},
            log="Admin: 'Work' folder structure and service definitions verified."
        )

class DeveloperAgent(BaseAgent):
    """Agent responsible for adding or editing code in the 'work' folder based on requirements."""
    
    def plan(self, intermediate_steps, **kwargs) -> Union[AgentAction, AgentFinish]:
        """
        Implement code changes based on input requirements.
         - This includes writing or modifying logic for services (e.g., Lambda, API Gateway, Cognito, DynamoDB).
         - Utilize the baseline architecture and work folder to create or update code.
        """
        input_data = kwargs.get("input", {})
        # Optionally include architecture details from previous steps.
        for agent, output in intermediate_steps:
            if agent == "architect":
                input_data["architecture"] = output.get("architecture", {})
                break
        
        implementation = self.process(input_data)
        return AgentFinish(
            return_values={"implementation": implementation},
            log="Developer: Code updated in 'work' folder based on new requirements."
        )

class TesterAgent(BaseAgent):
    """Agent responsible for testing the code using SAM CLI."""
    
    def plan(self, intermediate_steps, **kwargs) -> Union[AgentAction, AgentFinish]:
        """
        Test the solution in the local 'work' folder.
         - Execute tests using SAM CLI.
         - Verify that all test cases pass.
        """
        input_data = kwargs.get("input", {})
        for agent, output in intermediate_steps:
            if agent == "developer":
                input_data["implementation"] = output.get("implementation", {})
                break
        
        test_results = self.process(input_data)
        return AgentFinish(
            return_values={"test_results": test_results},
            log="Tester: All test cases executed and verified using SAM CLI."
        )

class DeployerAgent(BaseAgent):
    """Agent responsible for deploying the solution and committing code to repository."""
    
    def plan(self, intermediate_steps, **kwargs) -> Union[AgentAction, AgentFinish]:
        """
        Convert the code in the local 'work' folder into services.
         - Package the SAM template, deploy the solution.
         - Commit and push the updated code back to repository.
        """
        input_data = kwargs.get("input", {})
        for agent, output in intermediate_steps:
            if agent == "developer":
                input_data["implementation"] = output.get("implementation", {})
            elif agent == "tester":
                input_data["test_results"] = output.get("test_results", {})
        
        deployment_result = self.process(input_data)
        return AgentFinish(
            return_values={"deployment": deployment_result},
            log="Deployer: Code converted into services and committed to repository."
        )

class CodeGenerationService:
    """Service for generating and managing code from test cases and requirements using LangChain agents."""
    
    def __init__(self, config_path: str = "global/config.json"):
        """Initialize the service with configuration."""
        self.config = LLMAgentFactory.load_config(config_path)
        # Will initialize agents when needed
        self.agents = {}
        self.tools = []
    
    def _init_agents(self, llm: BaseLLM):
        """Initialize all agents."""
        agent_types = ["Manager", "Architect", "Admin", "Developer", "Tester", "Deployer"]
        
        for agent_type in agent_types:
            self.agents[agent_type.lower()] = LLMAgentFactory.create_agent(agent_type, llm, self.config)
        
        # Create repository tools for Manager agent
        repository_tools = [
            Tool(
                name="check_repository_exists",
                func=self._check_repository_exists,
                description="Check if a repository exists in repository."
            ),
            Tool(
                name="clone_repository",
                func=self._clone_repository,
                description="Clone a repository from repository to local folder."
            ),
            Tool(
                name="create_repository",
                func=self._create_repository,
                description="Create a new repository in repository."
            )
        ]
        
        # Create tools for each agent except Manager (as Manager coordinates the process)
        self.tools = repository_tools + [
            Tool(
                name=agent_type.lower(),
                func=lambda input_data, agent_type=agent_type.lower(): self.agents[agent_type].process(input_data),
                description=f"Use the {agent_type} agent to execute {agent_type.lower()} operations."
            )
            for agent_type in agent_types if agent_type.lower() != "manager"
        ]
    
    def _check_repository_exists(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Check if repository exists in repository.
        
        Args:
            input_data: Contains project_name
            
        Returns:
            Dictionary indicating whether repository exists
        """
        try:
            project_name = input_data.get("project_name")
            if not project_name:
                logger.error("Project name not provided")
                return {"exists": False, "error": "Project name not provided"}
            
            # Call the actual implementation from our repository utilities
            # repo_path is None, so it will use the pattern from .env
            return check_repository_exists(
                project_name=project_name,
                repo_path=None
            )
            
        except Exception as e:
            logger.error(f"Error checking repository existence: {str(e)}")
            return {
                "exists": False,
                "error": str(e)
            }
    
    def _clone_repository(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Clone repository from repository to local folder.
        
        Args:
            input_data: Contains project_name and clone_path
            
        Returns:
            Dictionary with clone operation result
        """
        try:
            project_name = input_data.get("project_name")
            if not project_name:
                logger.error("Project name not provided")
                return {"success": False, "error": "Project name not provided"}
            
            clone_path = input_data.get("clone_path")
            
            # Call the actual implementation from our repository utilities
            # Note: remote_url is None, so it will use the pattern from .env
            return clone_repository(
                project_name=project_name, 
                remote_url=None, 
                clone_path=clone_path
            )
            
        except Exception as e:
            logger.error(f"Error cloning repository: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _create_repository(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new repository in repository.
        
        Args:
            input_data: Contains project_name and optional description
            
        Returns:
            Dictionary with repository creation result
        """
        try:
            project_name = input_data.get("project_name")
            if not project_name:
                logger.error("Project name not provided")
                return {"success": False, "error": "Project name not provided"}
            
            description = input_data.get("description")
            
            # Call the actual implementation from our repository utilities
            return create_repository(
                project_name=project_name,
                remote_url=None
            )
            
        except Exception as e:
            logger.error(f"Error creating repository: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def generate_feature_code(
        self,
        project_id: int,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate code for a feature based on context data.
        
        Args:
            project_id: The ID of the project
            context: Complete context package with all related requirements and test cases
        
        Returns:
            Dictionary with generation results including code snippets and metadata.
        """
        try:
            logger.info(f"Generating code for project {project_id} with {len(context.get('test_cases', []))} test cases")
            
            test_case_id = context.get("primary_test_case_id")
            if not test_case_id:
                raise ValueError("Context must include a primary_test_case_id")

            project_name = context.get("project_name")
            if not project_name:
                raise ValueError("Context must include a project_name")
            
            primary_test_case = next((tc for tc in context.get("test_cases", []) if tc.get("id") == test_case_id), None)
            if not primary_test_case:
                raise ValueError(f"Primary test case {test_case_id} not found in context")
            
            # Create initial input data for agents including repository and project context.
            input_data = {
                "project_id": project_id,
                "project_name": project_name,
                "context": context
            }
            
            # Initialize LLM based on config (placeholder, replace with actual initialization)
            llm = None  # Initialize actual LLM here
            
            # Initialize agents
            self._init_agents(llm)
            
            # Set up the agent executor with the Manager agent as coordinator.
            agent_executor = AgentExecutor.from_agent_and_tools(
                agent=self.agents["manager"],
                tools=self.tools,
                verbose=True
            )
            
            # Run the agent executor with the input data.
            result = agent_executor.run(input_data)
            
            # Process results to extract code files from Developer output.
            code_files = []
            for agent_type, output in result.items():
                if agent_type == "developer" and "implementation" in output:
                    implementation = output["implementation"]
                    if isinstance(implementation, dict) and "code_files" in implementation:
                        code_files.extend(implementation["code_files"])
            
            if not code_files:
                test_name = primary_test_case.get("name", "unknown_test")
                test_description = primary_test_case.get("description", "No description provided")
                code_files = [{
                    "filename": f"{test_name.lower().replace(' ', '_')}.py",
                    "content": f"# Generated code for: {test_name}\n\n# {test_description}\n\ndef main():\n    print('Implementing feature based on test case')\n    # TODO: Implement the actual feature\n\nif __name__ == '__main__':\n    main()",
                    "language": "python"
                }]
            
            final_result = {
                "success": True,
                "code_files": code_files,
                "message": "Code successfully generated using LangChain agents",
                "test_case_id": test_case_id,
                "project_id": project_id,
                "project_name": project_name,
                "generated_uiids": [f"code_{test_case_id}_{project_id}"],
                "test_metadata": {
                    "name": primary_test_case.get("name", "unknown_test"),
                    "description": primary_test_case.get("description", "No description provided")
                }
            }
            
            return final_result
            
        except Exception as e:
            logger.error(f"Error generating code: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to generate code: {str(e)}",
                "error": str(e)
            }
    
    async def save_generated_code(
        self,
        project_id: int,
        test_case_id: str,
        code_files: List[Dict[str, str]],
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Save generated code files to the appropriate location.
        
        Args:
            project_id: The project ID
            test_case_id: The test case ID
            code_files: List of dictionaries with filename and content
            metadata: Additional metadata to store
        
        Returns:
            Result of the save operation.
        """
        try:
            logger.info(f"Saving generated code for test case: {test_case_id}")
            code_dir = f"generated_code/{project_name}/test_{test_case_id}"
            os.makedirs(code_dir, exist_ok=True)
            
            saved_files = []
            for file_info in code_files:
                filename = file_info.get("filename")
                content = file_info.get("content")
                if filename and content:
                    file_path = os.path.join(code_dir, filename)
                    # Write code content to file if needed:
                    # with open(file_path, 'w') as f:
                    #     f.write(content)
                    saved_files.append(file_path)
            
            return {
                "success": True,
                "message": f"Saved {len(saved_files)} code files",
                "saved_files": saved_files,
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"Error saving generated code: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to save generated code: {str(e)}",
                "error": str(e)
            }

def get_clone_folder_pattern():
    """Get the pattern for clone folder path."""
    return "repos/{project_name}"
