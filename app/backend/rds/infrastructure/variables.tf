# ==================================================
# RDS MODULE - MINIMAL VARIABLES USING OBJECTS
# ==================================================

# Common configuration object
variable "common_config" {
  description = "Common configuration object containing project_name, environment, aws_region, tags"
  type = object({
    project_name = string
    environment  = string
    aws_region   = string
    name_prefix  = string
    tags         = map(string)
  })
}

# Database configuration object
variable "database_config" {
  description = "Database configuration object"
  type = object({
    db_name                  = string
    db_username              = string
    db_instance_class        = string
    db_allocated_storage     = number
    db_max_allocated_storage = number
    backup_retention_period  = number
    deletion_protection      = bool
  })
}

# Network configuration object
variable "network_config" {
  description = "Network configuration object"
  type = object({
    vpc_cidr             = string
    availability_zones   = list(string)
    public_subnet_ids    = list(string)
    private_subnet_ids   = list(string)
    database_subnet_ids  = list(string)
    lambda_sg_id         = string
    database_sg_id       = string
  })
} 