# Terraform Architecture Diagram Generator

The Architecture tab now includes a powerful Terraform architecture diagram generator that automatically parses `.tf` files from GitHub repositories and creates visual infrastructure diagrams.

## Features

### 🔍 **Automatic Terraform Detection**
- Scans GitHub repositories for `.tf` files
- Supports multiple Terraform files in a repository
- File browser to switch between different `.tf` files

### 🏗️ **Infrastructure Parsing**
- Extracts resources, modules, variables, and outputs
- Supports AWS, Azure, GCP, and other cloud providers
- Parses resource attributes and dependencies
- Identifies resource categories (compute, network, storage, etc.)

### 📊 **Visual Architecture Diagrams**
- Interactive infrastructure diagrams
- Color-coded by cloud provider (AWS orange, Azure blue, GCP blue)
- Resource icons based on category (🖥️ compute, 🌐 network, 💾 storage, etc.)
- Dependency arrows showing resource relationships

### 📋 **Detailed Resource Analysis**
- Resource breakdown with attributes
- Module information and sources
- Provider-specific resource categorization
- Attribute filtering and display

## Supported Terraform Resources

### AWS Resources
- **Compute**: `aws_instance`, `aws_lambda`, `aws_ecs`, `aws_eks`, `aws_autoscaling`
- **Network**: `aws_lb`, `aws_alb`, `aws_nlb`, `aws_vpc`, `aws_subnet`
- **Security**: `aws_security_group`, `aws_iam`
- **Storage**: `aws_s3`, `aws_ebs`
- **Database**: `aws_rds`, `aws_dynamodb`, `aws_elasticache`
- **Monitoring**: `aws_cloudwatch`
- **Messaging**: `aws_sns`, `aws_sqs`

### Azure Resources
- **Compute**: `azurerm_virtual_machine`, `azurerm_function_app`, `azurerm_container_group`, `azurerm_kubernetes_cluster`
- **Network**: `azurerm_lb`, `azurerm_virtual_network`, `azurerm_subnet`
- **Security**: `azurerm_network_security_group`
- **Storage**: `azurerm_storage_account`
- **Database**: `azurerm_sql_database`, `azurerm_redis_cache`

### GCP Resources
- **Compute**: `google_compute_instance`, `google_cloud_function`, `google_container_cluster`
- **Network**: `google_compute_forwarding_rule`, `google_compute_network`, `google_compute_subnetwork`
- **Security**: `google_compute_firewall`
- **Storage**: `google_storage_bucket`
- **Database**: `google_sql_database_instance`

## Usage

### Setting Up

1. **Configure GitHub Repository**:
   - Go to Settings → GitHub Repository
   - Enter repository path (e.g., `hashicorp/terraform-aws-vpc`)
   - Enter branch (default: `main`)
   - Save settings

2. **Access Architecture Tab**:
   - Navigate to any project
   - Click on the "Architecture" tab
   - The system will automatically scan for `.tf` files

3. **View Architecture**:
   - Select different `.tf` files from the sidebar
   - View the interactive architecture diagram
   - Examine resource details in the right panel

### Example Terraform Files

The system works with any standard Terraform configuration:

```hcl
# main.tf
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "main"
  }
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
  
  tags = {
    Name = "public"
  }
}

resource "aws_instance" "web" {
  ami           = "ami-12345678"
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id
  
  tags = {
    Name = "web-server"
  }
}
```

## Technical Implementation

### Architecture Components

```
ArchitectureTab
├── TerraformArchitectureViewer (Main viewer)
├── GitHubService (File fetching)
├── TerraformParser (Configuration parsing)
└── Architecture Diagram (Visual representation)
```

### Key Components

1. **TerraformParser** (`src/lib/terraformParser.ts`)
   - Parses Terraform configuration files
   - Extracts resources, modules, variables, outputs
   - Builds architecture diagrams
   - Categorizes resources by type and provider

2. **TerraformArchitectureViewer** (`src/components/architecture/TerraformArchitectureViewer.tsx`)
   - Main viewer component
   - File browser for multiple `.tf` files
   - Interactive diagram display
   - Resource detail panel

3. **ArchitectureTab** (`src/components/tabs/ArchitectureTab.tsx`)
   - Integration with GitHub settings
   - Error handling and user guidance
   - Repository validation

### Parsing Capabilities

The parser supports:

- **Resource Blocks**: `resource "type" "name" { ... }`
- **Module Blocks**: `module "name" { ... }`
- **Variable Blocks**: `variable "name" { ... }`
- **Output Blocks**: `output "name" { ... }`
- **Provider Blocks**: `provider "name" { ... }`
- **Data Sources**: `data "type" "name" { ... }`

### Diagram Generation

1. **Node Creation**: Each resource becomes a node with:
   - Position calculated for circular layout
   - Color based on cloud provider
   - Icon based on resource category
   - Label showing resource type and name

2. **Edge Creation**: Dependencies are mapped as:
   - Arrows between dependent resources
   - Dashed lines for visual clarity
   - Directional flow showing relationships

3. **Layout**: Resources are positioned in a circular layout for optimal visualization

## Error Handling

The system includes comprehensive error handling:

- **No Terraform Files**: Clear message when no `.tf` files are found
- **Private Repositories**: Guidance for public repository alternatives
- **Invalid Repository**: Format validation and suggestions
- **Parse Errors**: Graceful handling of malformed Terraform files

## Future Enhancements

Potential improvements for the Terraform architecture viewer:

1. **Advanced Layouts**: Force-directed, hierarchical, or custom layouts
2. **Interactive Diagrams**: Click to expand/collapse resource groups
3. **Resource Filtering**: Filter by provider, category, or tags
4. **Export Options**: Export diagrams as PNG, SVG, or PDF
5. **Real-time Updates**: Live updates when Terraform files change
6. **Cost Estimation**: Integration with Terraform cost estimation
7. **Security Analysis**: Highlight security-related resources and configurations
8. **Compliance Checking**: Validate against security and compliance standards
9. **Multi-file Analysis**: Combine multiple `.tf` files into single diagram
10. **Version Comparison**: Compare architecture changes between branches

## Configuration

The Terraform architecture viewer uses the same GitHub settings as the Code tab:

```json
{
  "github": {
    "repo": "owner/repository",
    "branch": "main"
  }
}
```

This ensures consistency across the application and allows users to view both code and architecture from the same repository. 