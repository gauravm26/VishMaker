# VishMaker AWS Infrastructure with Terraform

This directory contains Terraform configuration for deploying VishMaker to AWS. The infrastructure includes a React frontend hosted on S3/CloudFront, a FastAPI backend running on ECS Fargate, and a PostgreSQL database on RDS.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFront    │    │      ALB        │    │   ECS Fargate   │
│   (Frontend)    │────│   (Backend)     │────│   (Backend)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   S3 Bucket     │    │   Route53 DNS   │    │  RDS PostgreSQL │
│   (Assets)      │    │   (Optional)    │    │   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Infrastructure Components

### Networking
- **VPC**: Custom VPC with public, private, and database subnets across 2 AZs
- **Internet Gateway**: For public subnet internet access
- **NAT Gateways**: For private subnet outbound internet access
- **Security Groups**: Restrictive security groups for each component

### Frontend
- **S3 Bucket**: Hosts the React application build files
- **CloudFront**: CDN for global content delivery and custom domain support
- **Route53**: DNS management (optional, for custom domains)

### Backend
- **ECS Fargate**: Serverless container hosting for the FastAPI application
- **Application Load Balancer**: HTTP/HTTPS load balancing and SSL termination
- **ECR**: Container registry for the backend Docker image
- **Secrets Manager**: Secure storage for database credentials

### Database
- **RDS PostgreSQL**: Managed database service with automated backups
- **DB Subnet Group**: Database subnets across multiple AZs
- **Parameter Group**: Custom database configuration

### Security & Monitoring
- **IAM Roles**: Least-privilege access for ECS tasks
- **CloudWatch**: Logging and monitoring
- **SSL Certificates**: Automatic SSL certificate management via ACM

## Prerequisites

1. **AWS Account**: Active AWS account with appropriate permissions
2. **AWS CLI**: Configured with your credentials
3. **Terraform**: Version 1.0 or later
4. **Docker**: For building and pushing container images
5. **Node.js/npm**: For building the frontend

### Required AWS Permissions

Your AWS user/role needs permissions for:
- VPC, EC2, and networking resources
- ECS, ECR, and container services
- RDS and database resources
- S3, CloudFront, and content delivery
- IAM roles and policies
- Secrets Manager
- Route53 (if using custom domain)
- ACM (SSL certificates)

## Quick Start

### 1. Configure Terraform Variables

```bash
# Copy the example file
cp terraform.tfvars.example terraform.tfvars

# Edit the file with your specific configuration
vim terraform.tfvars
```

### 2. Deploy Infrastructure

```bash
# Make the deployment script executable
chmod +x ../deploy.sh

# Deploy to development environment
../deploy.sh

# Deploy to production
../deploy.sh -e prod
```

## Manual Deployment Steps

If you prefer to run the deployment manually:

### 1. Initialize Terraform

```bash
cd infrastructure/terraform
terraform init
```

### 2. Plan the Deployment

```bash
terraform plan -var-file="terraform.tfvars"
```

### 3. Apply the Infrastructure

```bash
terraform apply -var-file="terraform.tfvars"
```

### 4. Build and Push Backend Image

```bash
# Get ECR repository URL
ECR_REPO=$(terraform output -raw ecr_repository_url)

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO

# Build and push image
cd ../../
docker build -t vishmaker-backend .
docker tag vishmaker-backend:latest $ECR_REPO:latest
docker push $ECR_REPO:latest
```

### 5. Deploy Frontend

```bash
# Build frontend
cd app-ui
npm install
npm run build

# Upload to S3
BUCKET_NAME=$(terraform output -raw frontend_bucket_name)
aws s3 sync dist/ s3://$BUCKET_NAME --delete

# Invalidate CloudFront cache
CLOUDFRONT_ID=$(terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"
```

## Configuration

### Terraform Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `project_name` | Name of the project | `vishmaker` | No |
| `environment` | Environment name | `dev` | No |
| `aws_region` | AWS region | `us-east-1` | No |
| `create_domain` | Create Route53 hosted zone | `false` | No |
| `domain_name` | Custom domain name | `""` | No |
| `vpc_cidr` | VPC CIDR block | `10.0.0.0/16` | No |
| `db_instance_class` | RDS instance class | `db.t3.micro` | No |
| `backend_cpu` | ECS task CPU units | `256` | No |
| `backend_memory` | ECS task memory (MB) | `512` | No |

### Environment-Specific Configurations

#### Development
- Minimal resources for cost optimization
- Single AZ deployment for non-critical components
- Shorter backup retention periods

#### Production
- Multi-AZ deployment for high availability
- Enhanced monitoring and performance insights
- Longer backup retention periods
- Deletion protection enabled

## Custom Domain Setup

To use a custom domain:

1. Set `create_domain = true` in `terraform.tfvars`
2. Provide your domain name in `domain_name`
3. After deployment, update your domain's nameservers to use the Route53 nameservers

```bash
# Get nameservers after deployment
terraform output name_servers
```

## Monitoring and Logging

### CloudWatch Logs
- ECS task logs: `/ecs/vishmaker-{environment}-backend`
- Application logs are automatically collected

### Metrics
- ECS service metrics
- ALB metrics
- RDS metrics
- CloudFront metrics

### Alarms (Production)
- ECS service health
- RDS CPU and connections
- ALB response times

## Security

### Best Practices Implemented
- All traffic encrypted in transit (HTTPS/TLS)
- Database encryption at rest
- Least-privilege IAM roles
- Private subnets for backend and database
- Security groups with minimal required access
- Secrets stored in AWS Secrets Manager

### Security Groups
- **ALB**: Allows HTTP/HTTPS from internet
- **ECS**: Allows traffic only from ALB
- **RDS**: Allows PostgreSQL only from ECS
- **VPC Endpoints**: Allows HTTPS from ECS

## Backup and Disaster Recovery

### RDS Backups
- Automated daily backups
- Point-in-time recovery
- Configurable retention period

### S3 Versioning
- Frontend assets versioned
- Easy rollback capability

## Cost Optimization

### Development Environment
- `db.t3.micro` RDS instance
- Minimal ECS resources
- Single NAT Gateway

### Production Scaling
- Auto-scaling ECS services
- RDS storage auto-scaling
- CloudFront caching reduces origin load

## Troubleshooting

### Common Issues

1. **Terraform Apply Fails**
   ```bash
   # Check AWS credentials
   aws sts get-caller-identity
   
   # Verify permissions
   aws iam get-user
   ```

2. **ECS Service Won't Start**
   ```bash
   # Check ECS service events
   aws ecs describe-services --cluster CLUSTER_NAME --services SERVICE_NAME
   
   # Check CloudWatch logs
   aws logs describe-log-streams --log-group-name /ecs/vishmaker-dev-backend
   ```

3. **Frontend Not Loading**
   ```bash
   # Check S3 bucket contents
   aws s3 ls s3://BUCKET_NAME/
   
   # Check CloudFront distribution status
   aws cloudfront get-distribution --id DISTRIBUTION_ID
   ```

### Debugging Commands

```bash
# Get all Terraform outputs
terraform output

# Check ECS service status
aws ecs describe-services --cluster $(terraform output -raw ecs_cluster_name) --services vishmaker-dev-backend-service

# View recent logs
aws logs tail /ecs/vishmaker-dev-backend --follow

# Check RDS status
aws rds describe-db-instances --db-instance-identifier $(terraform output -raw rds_endpoint | cut -d. -f1)
```

## Cleanup

To destroy all infrastructure:

```bash
# Destroy everything
terraform destroy -var-file="terraform.tfvars"
```

**Warning**: This will permanently delete all resources, including the database!

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review CloudWatch logs for application errors
3. Verify AWS service limits and quotas
4. Check the GitHub repository for known issues

## Contributing

When modifying the infrastructure:
1. Test changes in a development environment first
2. Update this README if adding new components
3. Follow Terraform best practices
4. Add appropriate tags to new resources 