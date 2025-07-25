# VishMaker Infrastructure

This directory contains the Terraform infrastructure configuration for VishMaker, designed to work with your existing AWS CloudFront distribution and S3 bucket.

## 🚀 Quick Start

### 1. Configure Your Settings

Edit `global/config.json` with your actual values:

```json
{
  "infrastructure": {
    "project_name": "vishmaker",
    "environment": "dev",
    "aws_region": "us-east-1",
    "domain_name": "yourdomain.com",           // ← Your actual domain
    "cloudfront_distribution_id": "E1234567890123"  // ← Your CloudFront ID
  }
}
```

### 2. Deploy Everything

From the project root, run:

```bash
./infrastructure/deploy.sh
```

This will:
- ✅ Generate Terraform variables from your config
- ✅ Deploy infrastructure (VPC, ECS, RDS, etc.)
- ✅ Build and push Docker images
- ✅ Deploy frontend to your existing S3/CloudFront

## 📋 What You Need

**Required** (update in `global/config.json`):
- `domain_name`: Your actual domain name
- `cloudfront_distribution_id`: Your existing CloudFront distribution ID

**Optional** (sensible defaults provided):
- `project_name`: Project identifier (default: "vishmaker")
- `environment`: Deployment environment (default: "dev")
- `aws_region`: AWS region (default: "us-east-1")

## 🏗️ Architecture

The infrastructure creates:

### Existing Resources (You Provide)
- **CloudFront Distribution**: Your existing CDN
- **S3 Bucket**: Discovered from CloudFront origin
- **Route53 Hosted Zone**: Discovered by domain name

### New Resources (Created by Terraform)
- **VPC**: `{environment}-{project_name}-vpc`
- **ECS Cluster**: `{environment}-{project_name}-cluster`
- **RDS Database**: `{environment}-{project_name}-postgresql`
- **Load Balancer**: `{environment}-{project_name}-alb`
- **Security Groups**: `{environment}-{project_name}-*-sg`

### API Integration
- **Route53 Record**: `api.yourdomain.com` → ALB
- **CloudFront**: Existing distribution serves frontend
- **Backend**: ECS tasks behind ALB

## 🛠️ Manual Operations

### Generate Terraform Variables Only
```bash
cd infrastructure/terraform
python3 generate_tfvars.py
```

### Deploy Infrastructure Only
```bash
./infrastructure/deploy.sh --skip-docker --skip-frontend
```

### Deploy Application Only
```bash
./infrastructure/deploy.sh --skip-terraform
```

## 📁 File Structure

```
infrastructure/
├── deploy.sh              # Main deployment script
├── terraform/
│   ├── generate_tfvars.py  # Config → Terraform variables
│   ├── terraform.tfvars    # Generated (don't edit)
│   ├── main.tf            # Core configuration
│   ├── frontend.tf        # Existing infrastructure discovery
│   ├── domain.tf          # Route53 API record
│   ├── networking.tf      # VPC, subnets, security groups
│   ├── ecs.tf            # Container infrastructure
│   ├── database.tf       # RDS PostgreSQL
│   ├── load_balancer.tf  # Application Load Balancer
│   └── outputs.tf        # Infrastructure outputs
```

## 🔧 Configuration Details

All Terraform variables are automatically set with sensible defaults:

- **VPC**: Standard 3-tier architecture (10.0.0.0/16)
- **Database**: Cost-effective t3.micro instance
- **ECS**: Single task for development
- **Storage**: S3 with versioning enabled
- **CDN**: PriceClass_100 for cost optimization

## 🆘 Troubleshooting

### "No CloudFront distribution found"
- Verify your `cloudfront_distribution_id` in `global/config.json`
- Ensure the distribution exists in your AWS account

### "Route53 hosted zone not found"
- Verify your `domain_name` in `global/config.json`
- Ensure the hosted zone exists for your domain

### "Terraform fails to plan/apply"
- Check AWS credentials: `aws sts get-caller-identity`
- Ensure you have required permissions for VPC, ECS, RDS, etc.

## 🗑️ Cleanup

To destroy all created infrastructure:

```bash
cd infrastructure/terraform
terraform destroy
```

**Note**: This only destroys resources created by Terraform. Your existing CloudFront distribution and S3 bucket remain untouched. 