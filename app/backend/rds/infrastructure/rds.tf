# RDS Service Linked Role (Required for RDS)
resource "aws_iam_service_linked_role" "rds" {
  aws_service_name = "rds.amazonaws.com"
}

# Random password for RDS instance
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Secret to store database credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.common_config.name_prefix}-db-credentials"
  description = "Database credentials for VishMaker application"

  tags = var.common_config.tags
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.database_config.db_username
    password = random_password.db_password.result
    host     = aws_db_instance.main.endpoint
    port     = aws_db_instance.main.port
    dbname   = var.database_config.db_name
  })
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.common_config.name_prefix}-db-subnet-group"
  subnet_ids = var.network_config.database_subnet_ids

  tags = merge(var.common_config.tags, {
    Name = "${var.common_config.name_prefix}-db-subnet-group"
  })
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier = "${var.common_config.name_prefix}-database"

  # Engine settings
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.database_config.db_instance_class

  # Database settings
  db_name  = var.database_config.db_name
  username = var.database_config.db_username
  password = random_password.db_password.result

  # Storage settings
  allocated_storage     = var.database_config.db_allocated_storage
  max_allocated_storage = var.database_config.db_max_allocated_storage
  storage_type          = "gp2"
  storage_encrypted     = true

  # Network settings
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.network_config.database_sg_id]
  publicly_accessible    = false

  # Backup settings
  backup_retention_period = var.database_config.backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  # Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  # Other settings
  skip_final_snapshot = true
  deletion_protection = var.database_config.deletion_protection

  depends_on = [aws_iam_service_linked_role.rds]

  # Performance insights
  performance_insights_enabled = true
  performance_insights_retention_period = 7

  tags = merge(var.common_config.tags, {
    Name = "${var.common_config.name_prefix}-database"
  })
}

# IAM role for RDS enhanced monitoring
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "${var.common_config.name_prefix}-rds-enhanced-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = var.common_config.tags
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
} 