#!/usr/bin/env bash
set -euo pipefail

# Build React frontend for production
pushd app-ui >/dev/null
npm install
npm run build
popd >/dev/null

# Build and optionally deploy using AWS SAM
TEMPLATE_FILE="infrastructure/aws/template.yaml"

sam build --template-file "$TEMPLATE_FILE"

if [[ "${DEPLOY:-false}" == "true" ]]; then
    STACK_NAME=${STACK_NAME:-vishmaker}
    S3_BUCKET=${S3_BUCKET:-}
    if [[ -z "$S3_BUCKET" ]]; then
        echo "S3_BUCKET variable required when DEPLOY=true" >&2
        exit 1
    fi
    sam deploy \
        --template-file "$TEMPLATE_FILE" \
        --stack-name "$STACK_NAME" \
        --s3-bucket "$S3_BUCKET" \
        --resolve-s3 \
        --capabilities CAPABILITY_IAM
fi

# Optional: upload frontend build to S3 bucket
if [[ "${SYNC_STATIC:-false}" == "true" ]]; then
    if [[ -z "${FRONTEND_BUCKET:-}" ]]; then
        echo "FRONTEND_BUCKET variable not set for static upload" >&2
        exit 1
    fi
    aws s3 sync app-ui/dist "s3://$FRONTEND_BUCKET" --delete
fi

echo "Serverless build complete"

