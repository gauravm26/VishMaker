#!/usr/bin/env bash
set -euo pipefail

# Build React frontend for production
pushd app-ui >/dev/null
npm install
npm run build
popd >/dev/null

TERRAFORM_DIR="infrastructure/aws/terraform"

pushd "$TERRAFORM_DIR" >/dev/null
terraform init
if [[ "${APPLY:-false}" == "true" ]]; then
    terraform apply -auto-approve
else
    terraform plan
fi
popd >/dev/null

# Optional: upload frontend build to S3 bucket
if [[ "${SYNC_STATIC:-false}" == "true" ]]; then
    if [[ -z "${FRONTEND_BUCKET:-}" ]]; then
        echo "FRONTEND_BUCKET variable not set for static upload" >&2
        exit 1
    fi
    aws s3 sync app-ui/dist "s3://$FRONTEND_BUCKET" --delete
fi

echo "Serverless build complete"
