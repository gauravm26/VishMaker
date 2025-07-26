# RDS Service Linked Role (Required for RDS)
resource "aws_iam_service_linked_role" "rds" {
  aws_service_name = "rds.amazonaws.com"
}

# RDS PostgreSQL Database
resource "aws_db_instance" "postgresql" {
  identifier_prefix      = local.name_prefix
  engine                 = "postgres"
  instance_class         = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  max_allocated_storage  = var.db_max_allocated_storage
  storage_type           = "gp2"
  username               = var.db_username
  password               = random_password.db_password.result
  db_name                = var.db_name
  multi_az               = false # Set to true for production
  publicly_accessible    = false
  skip_final_snapshot    = true # Set to false for production
  db_subnet_group_name   = aws_db_subnet_group.database.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  depends_on = [aws_iam_service_linked_role.rds]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgresql"
  })
}

# Database Subnet Group
resource "aws_db_subnet_group" "database" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.database[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
} 