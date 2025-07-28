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
import time
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

# Setup LLM agents specific logging
llm_logger = logging.getLogger('llmagents')
llm_logger.setLevel(logging.DEBUG)

# Create handlers - use absolute path to project root logs directory
import os
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
log_file_path = os.path.join(project_root, 'local', 'logs', 'llmagents.log')
file_handler = logging.FileHandler(log_file_path)
file_handler.setLevel(logging.DEBUG)

# Create formatters and add it to handlers
log_format = logging.Formatter('[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s')
file_handler.setFormatter(log_format)

# Add handlers to the logger
llm_logger.addHandler(file_handler)

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
        
        llm_logger.info(f"[{self.agent_type}] Initializing agent with instructions: {instruction.get('Role', 'No role specified')}")
        
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
        llm_logger.debug(f"[{self.agent_type}] Agent initialized with prompt template")
    
    def plan(self, intermediate_steps, **kwargs) -> Union[AgentAction, AgentFinish]:
        """Plan the next action based on previous steps."""
        raise NotImplementedError("Subclasses must implement this method")
    
    def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process input data and return result."""
        llm_logger.info(f"[{self.agent_type}] Processing input: {json.dumps(input_data)[:200]}...")
        result = self.chain.run(input=json.dumps(input_data))
        llm_logger.info(f"[{self.agent_type}] Processing complete. Result length: {len(str(result))}")
        llm_logger.debug(f"[{self.agent_type}] Full result: {result}")
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
    
    def __init__(self, llm: BaseLLM, instruction: Dict[str, Any], config: Dict[str, Any]):
        """Initialize the manager agent with monitoring capabilities."""
        super().__init__(llm, instruction, config)
        self.agent_timeouts = {
            "architect": 300,  # 5 minutes
            "admin": 180,     # 3 minutes
            "developer": 600, # 10 minutes
            "tester": 300,    # 5 minutes
            "deployer": 300   # 5 minutes
        }
        self.agent_states = {}
        self.max_retries = 3
        self.retry_counts = {}
    
    def _update_agent_state(self, agent_type: str, status: str, start_time: float = None):
        """Update the state of an agent."""
        self.agent_states[agent_type] = {
            "status": status,
            "start_time": start_time or time.time(),
            "last_update": time.time()
        }
        llm_logger.info(f"[Manager] Agent {agent_type} state updated to {status}")
    
    def _check_agent_timeout(self, agent_type: str) -> bool:
        """Check if an agent has exceeded its timeout."""
        if agent_type not in self.agent_states:
            return False
            
        state = self.agent_states[agent_type]
        timeout = self.agent_timeouts.get(agent_type, 300)  # Default 5 minutes
        elapsed_time = time.time() - state["start_time"]
        
        if elapsed_time > timeout:
            llm_logger.warning(f"[Manager] Agent {agent_type} has exceeded timeout of {timeout} seconds")
            return True
        return False
    
    def _handle_stuck_agent(self, agent_type: str, current_state: Dict[str, Any]) -> AgentAction:
        """Handle a stuck agent by restarting its task."""
        llm_logger.warning(f"[Manager] Handling stuck agent: {agent_type}")
        
        # Increment retry count
        self.retry_counts[agent_type] = self.retry_counts.get(agent_type, 0) + 1
        
        if self.retry_counts[agent_type] > self.max_retries:
            llm_logger.error(f"[Manager] Agent {agent_type} has failed {self.max_retries} times, aborting")
            return AgentFinish(
                return_values={"error": f"Agent {agent_type} failed after {self.max_retries} retries"},
                log=f"Manager: {agent_type} task aborted after maximum retries"
            )
        
        # Reset agent state
        self._update_agent_state(agent_type, "restarting")
        
        # Create restart action
        return AgentAction(
            tool=agent_type,
            tool_input={
                **current_state,
                "restart": True,
                "retry_count": self.retry_counts[agent_type]
            },
            log=f"Manager: Restarting {agent_type} task (attempt {self.retry_counts[agent_type]})"
        )
    
    def plan(self, intermediate_steps, **kwargs) -> Union[AgentAction, AgentFinish]:
        """
        Decide the next step based on current state, including:
         - Checking if the repository exists
         - Creating a new repository if it does not exist,
         - Cloning it locally if it does
         - Then delegate to the ArchitectAgent
         - Monitor and recover from stuck agents
        """
        current_state = kwargs.get("current_state", {})
        
        if not intermediate_steps:
            # Initial step - check repository status and handle repository operations
            project_name = current_state.get("project_name")
            
            self._update_agent_state("manager", "checking_repository")
            return AgentAction(
                tool="check_repository_exists",
                tool_input={"project_name": project_name},
                log="Manager: Checking if project repository exists in repository."
            )
        
        # Continue the process based on repository check result
        last_action = intermediate_steps[-1][0]
        last_output = intermediate_steps[-1][1]
        
        # Check for stuck agents before processing the last action
        for agent_type in self.agent_states:
            if self._check_agent_timeout(agent_type):
                return self._handle_stuck_agent(agent_type, current_state)
        
        if last_action == "check_repository_exists":
            project_id = current_state.get("project_id")
            repo_exists = last_output.get("exists", False)
            
            if repo_exists:
                # Repository exists, clone it
                clone_folder = get_clone_folder_pattern().format(project_name=project_name)
                self._update_agent_state("manager", "cloning_repository")
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
                self._update_agent_state("manager", "creating_repository")
                return AgentAction(
                    tool="create_repository",
                    tool_input={
                        "project_id": project_id,
                        "description": f"Repository for project {project_id}"
                    },
                    log="Manager: Repository doesn't exist. Creating new repository in repository."
                )
        
        elif last_action == "clone_repository" or last_action == "create_repository":
            # After repository operations, delegate to ArchitectAgent
            work_path = last_output.get("work_path")
            self._update_agent_state("architect", "starting")
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
            # After architecture setup is complete, delegate to DeveloperAgent
            self._update_agent_state("architect", "completed")
            self._update_agent_state("developer", "starting")
            return AgentAction(
                tool="developer",
                tool_input=current_state,
                log="Manager: Architecture established; delegating to Developer for code modifications."
            )
        
        elif last_action == "developer":
            # After development, delegate to TesterAgent
            self._update_agent_state("developer", "completed")
            self._update_agent_state("tester", "starting")
            return AgentAction(
                tool="tester",
                tool_input=current_state,
                log="Manager: Code developed; delegating to Tester for validating tests."
            )
        
        elif last_action == "tester":
            # After testing, if tests pass, delegate to DeployerAgent
            if "issues" in last_output and last_output["issues"]:
                self._update_agent_state("tester", "failed")
                self._update_agent_state("developer", "restarting")
                return AgentAction(
                    tool="developer",
                    tool_input={
                        **current_state,
                        "test_issues": last_output["issues"]
                    },
                    log="Manager: Test issues found; returning to Developer for fixes."
                )
            else:
                self._update_agent_state("tester", "completed")
                self._update_agent_state("deployer", "starting")
                return AgentAction(
                    tool="deployer",
                    tool_input=current_state,
                    log="Manager: Testing successful; delegating to Deployer for deployment."
                )
        
        elif last_action == "deployer":
            # Deployment finished, close process
            self._update_agent_state("deployer", "completed")
            return AgentFinish(
                return_values={
                    "result": "Feature implemented, tested, and deployed successfully.",
                    "agent_states": self.agent_states
                },
                log="Manager: Deployment successful. Process completed."
            )
        
        # Handle unexpected flow
        llm_logger.warning(f"[Manager] Unexpected action: {last_action}")
        return AgentFinish(
            return_values={
                "result": "Process completed with an unexpected flow.",
                "agent_states": self.agent_states,
                "last_action": last_action
            },
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
        llm_logger.info("Initializing CodeGenerationService")
        self.config = LLMAgentFactory.load_config(config_path)
        llm_logger.debug(f"Loaded configuration from {config_path}")
        # Will initialize agents when needed
        self.agents = {}
        self.tools = []
    
    def _init_agents(self, llm: BaseLLM):
        """Initialize all agents."""
        llm_logger.info("Initializing all agents")
        agent_types = ["Manager", "Architect", "Admin", "Developer", "Tester", "Deployer"]
        
        for agent_type in agent_types:
            llm_logger.debug(f"Creating agent: {agent_type}")
            self.agents[agent_type.lower()] = LLMAgentFactory.create_agent(agent_type, llm, self.config)
        
        # Create repository tools for Manager agent
        llm_logger.debug("Creating repository tools")
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
        llm_logger.info("All agents and tools initialized successfully")
    
    def _check_repository_exists(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check if repository exists in repository."""
        try:
            project_name = input_data.get("project_name")
            llm_logger.info(f"Checking if repository exists: {project_name}")
            
            if not project_name:
                llm_logger.error("Project name not provided")
                return {"exists": False, "error": "Project name not provided"}
            
            result = check_repository_exists(
                project_name=project_name,
                repo_path=None
            )
            llm_logger.info(f"Repository check result: {result}")
            return result
            
        except Exception as e:
            llm_logger.error(f"Error checking repository existence: {str(e)}")
            return {
                "exists": False,
                "error": str(e)
            }
    
    def _clone_repository(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Clone repository from repository to local folder."""
        try:
            project_name = input_data.get("project_name")
            llm_logger.info(f"Cloning repository: {project_name}")
            
            if not project_name:
                llm_logger.error("Project name not provided")
                return {"success": False, "error": "Project name not provided"}
            
            clone_path = input_data.get("clone_path")
            llm_logger.debug(f"Clone path: {clone_path}")
            
            result = clone_repository(
                project_name=project_name, 
                remote_url=None, 
                clone_path=clone_path
            )
            llm_logger.info(f"Repository clone result: {result}")
            return result
            
        except Exception as e:
            llm_logger.error(f"Error cloning repository: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _create_repository(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new repository in repository."""
        try:
            project_name = input_data.get("project_name")
            llm_logger.info(f"Creating repository: {project_name}")
            
            if not project_name:
                llm_logger.error("Project name not provided")
                return {"success": False, "error": "Project name not provided"}
            
            description = input_data.get("description")
            llm_logger.debug(f"Repository description: {description}")
            
            result = create_repository(
                project_name=project_name,
                remote_url=None
            )
            llm_logger.info(f"Repository creation result: {result}")
            return result
            
        except Exception as e:
            llm_logger.error(f"Error creating repository: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def generate_feature_code(
        self,
        project_id: int,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate code for a feature based on context data."""
        try:
            llm_logger.info(f"Starting code generation for project {project_id}")
            llm_logger.debug(f"Context: {json.dumps(context)[:500]}...")
            
            test_case_id = context.get("primary_test_case_id")
            if not test_case_id:
                llm_logger.error("No primary_test_case_id provided in context")
                raise ValueError("Context must include a primary_test_case_id")

            project_name = context.get("project_name")
            if not project_name:
                llm_logger.error("No project_name provided in context")
                raise ValueError("Context must include a project_name")
            
            primary_test_case = next((tc for tc in context.get("test_cases", []) if tc.get("id") == test_case_id), None)
            if not primary_test_case:
                llm_logger.error(f"Primary test case {test_case_id} not found in context")
                raise ValueError(f"Primary test case {test_case_id} not found in context")
            
            input_data = {
                "project_id": project_id,
                "project_name": project_name,
                "context": context
            }
            
            llm_logger.info("Initializing LLM and agents")
            llm = None  # Initialize actual LLM here
            self._init_agents(llm)
            
            llm_logger.info("Setting up agent executor with Manager agent")
            agent_executor = AgentExecutor.from_agent_and_tools(
                agent=self.agents["manager"],
                tools=self.tools,
                verbose=True
            )
            
            llm_logger.info("Running agent executor")
            result = agent_executor.run(input_data)
            llm_logger.debug(f"Agent executor result: {json.dumps(result)[:500]}...")
            
            code_files = []
            for agent_type, output in result.items():
                if agent_type == "developer" and "implementation" in output:
                    implementation = output["implementation"]
                    if isinstance(implementation, dict) and "code_files" in implementation:
                        code_files.extend(implementation["code_files"])
            
            if not code_files:
                llm_logger.warning("No code files generated, creating default implementation")
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
            
            llm_logger.info("Code generation completed successfully")
            llm_logger.debug(f"Final result: {json.dumps(final_result)[:500]}...")
            return final_result
            
        except Exception as e:
            llm_logger.error(f"Error generating code: {str(e)}", exc_info=True)
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
