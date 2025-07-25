# Database Initialization
resource "null_resource" "database_init" {
  depends_on = [aws_db_instance.postgresql]

  triggers = {
    db_instance_id = aws_db_instance.postgresql.id
    db_endpoint    = aws_db_instance.postgresql.endpoint
  }

  provisioner "local-exec" {
    command = <<-EOT
      cd ${path.module}/../../infrastructure/db && \
      python3 -c "
import os
import sys
from pathlib import Path

# Set the DATABASE_URL environment variable
os.environ['DATABASE_URL'] = 'postgresql://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.postgresql.endpoint}/${var.db_name}'

# Import and run database initialization
from db_core import init_db
init_db(drop_existing=False)
print('Database tables created successfully!')
"
    EOT
  }
} 