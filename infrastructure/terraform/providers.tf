# infrastructure/terraform/providers.tf

# Additional provider for US East 1 (required for CloudFront certificates)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  
  default_tags {
    tags = {
      Project     = "VishMaker"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
} 