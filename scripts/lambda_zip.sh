#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_usage() {
    echo "Usage: $0 [LAMBDA_NAME]"
    echo ""
    echo "Arguments:"
    echo "  LAMBDA_NAME    Build specific lambda (auth, llm, projects, requirements, waitlist, all, or default)"
    echo ""
    echo "Examples:"
    echo "  $0              # Build all available lambdas"
    echo "  $0 default      # Build default lambdas (auth, llm, projects, requirements, waitlist)"
    echo "  $0 auth         # Build only auth lambda"
    echo "  $0 llm          # Build only llm lambda"
    echo "  $0 projects     # Build only projects lambda"
    echo "  $0 requirements # Build only requirements lambda"
    echo "  $0 waitlist     # Build only waitlist lambda"
    echo "  $0 all          # Build all lambdas"
    echo ""
}

# Parse command line arguments
LAMBDA_TO_BUILD="${1:-all}"

# Define available lambdas
AVAILABLE_LAMBDAS=("auth" "llm" "projects" "requirements" "waitlist")
DEFAULT_LAMBDAS=("auth" "llm" "projects" "requirements" "waitlist")  # Default lambdas to build

# Validate lambda selection
case $LAMBDA_TO_BUILD in
    auth|llm|projects|requirements|waitlist|all|default)
        # Valid selection
        ;;
    *)
        print_usage
        echo -e "${RED}❌ Invalid lambda selection: $LAMBDA_TO_BUILD${NC}"
        echo -e "${RED}Valid options: ${AVAILABLE_LAMBDAS[*]}, all, default${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}🚀 Building VishMaker Lambda deployment packages...${NC}"
echo -e "${YELLOW}Target: $LAMBDA_TO_BUILD${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_ROOT="$PROJECT_ROOT/app/backend"
BUILD_DIR="$SCRIPT_DIR/.build"
DIST_DIR="$SCRIPT_DIR/dist"

echo -e "${YELLOW}📁 Backend root: $BACKEND_ROOT${NC}"
echo -e "${YELLOW}📁 Project root: $PROJECT_ROOT${NC}"

# Clean and create build directories
echo -e "${YELLOW}🧹 Cleaning build directories...${NC}"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Only clean DIST_DIR if building all lambdas or if it doesn't exist
if [ "$LAMBDA_TO_BUILD" = "all" ] || [ "$LAMBDA_TO_BUILD" = "default" ] || [ ! -d "$DIST_DIR" ]; then
    rm -rf "$DIST_DIR"
    mkdir -p "$DIST_DIR"
    echo -e "${YELLOW}🧹 Cleaned dist directory${NC}"
else
    mkdir -p "$DIST_DIR"
    echo -e "${YELLOW}📦 Preserving existing deployment packages in dist directory${NC}"
fi

# Function to build a Lambda package
build_lambda_package() {
    local LAMBDA_NAME=$1
    local LAMBDA_CODE_DIR="$BACKEND_ROOT/lambdas/$LAMBDA_NAME/code"
    local LAMBDA_BUILD_DIR="$BUILD_DIR/$LAMBDA_NAME"
    
    echo -e "${GREEN}📦 Building $LAMBDA_NAME Lambda package...${NC}"
    echo -e "${YELLOW}📁 Lambda code: $LAMBDA_CODE_DIR${NC}"
    
    # Create Lambda-specific build directory
    mkdir -p "$LAMBDA_BUILD_DIR"

    # Create a temporary virtual environment for building
    echo -e "${YELLOW}🔧 Creating temporary build environment for $LAMBDA_NAME...${NC}"
    python3.11 -m venv "$LAMBDA_BUILD_DIR/venv"
    source "$LAMBDA_BUILD_DIR/venv/bin/activate"

    # Clean the virtual environment completely
    echo -e "${YELLOW}🧹 Cleaning virtual environment...${NC}"
    pip uninstall -y boto3 botocore 2>/dev/null || true
    pip cache purge 2>/dev/null || true

    # Install dependencies
    echo -e "${YELLOW}📦 Installing $LAMBDA_NAME dependencies...${NC}"
    pip install --upgrade pip
    
    # Install packages with minimal dependencies to avoid pulling in boto3
    # For packages that we know are self-contained, use --no-deps
    case "$LAMBDA_NAME" in
        "auth")
            # Auth lambda - install with dependencies but we'll clean boto3 later
            pip install -r "$LAMBDA_CODE_DIR/requirements.txt" -t "$LAMBDA_BUILD_DIR/lambda_package"
            ;;
        "llm")
            # LLM lambda - install with dependencies but we'll clean boto3 later
            pip install -r "$LAMBDA_CODE_DIR/requirements.txt" -t "$LAMBDA_BUILD_DIR/lambda_package"
            ;;
        "projects")
            # Projects lambda - install with dependencies but we'll clean boto3 later
            pip install -r "$LAMBDA_CODE_DIR/requirements.txt" -t "$LAMBDA_BUILD_DIR/lambda_package"
            ;;
        "requirements")
            # Requirements lambda - install with dependencies but we'll clean boto3 later
            pip install -r "$LAMBDA_CODE_DIR/requirements.txt" -t "$LAMBDA_BUILD_DIR/lambda_package"
            ;;
        *)
            # Default - install with dependencies
            pip install -r "$LAMBDA_CODE_DIR/requirements.txt" -t "$LAMBDA_BUILD_DIR/lambda_package"
            ;;
    esac
    
    # Show what packages were installed (for debugging)
    echo -e "${YELLOW}🔍 Installed packages:${NC}"
    ls -la "$LAMBDA_BUILD_DIR/lambda_package" | grep -E "(boto|aws)" || echo "  No boto/aws packages found initially"
    
    # Show package size before cleanup
    PACKAGE_SIZE_BEFORE_CLEANUP=$(du -sh "$LAMBDA_BUILD_DIR/lambda_package" | cut -f1)
    echo -e "${YELLOW}📏 Package size before cleanup: $PACKAGE_SIZE_BEFORE_CLEANUP${NC}"

    # Copy Lambda source code
    echo -e "${YELLOW}📋 Copying $LAMBDA_NAME source code...${NC}"
    cp -r "$LAMBDA_CODE_DIR"/* "$LAMBDA_BUILD_DIR/lambda_package/"

    # Copy shared utilities
    echo -e "${YELLOW}📋 Copying shared utilities...${NC}"
    cp -r "$BACKEND_ROOT/lambdas/shared" "$LAMBDA_BUILD_DIR/lambda_package/"

    # Copy project source code that Lambda needs (conditional based on lambda type)
    echo -e "${YELLOW}📋 Copying project dependencies for $LAMBDA_NAME...${NC}"

    case "$LAMBDA_NAME" in
        "auth")
            echo -e "${YELLOW}📋 Auth lambda is self-contained - no external project dependencies needed${NC}"
            ;;

        "llm")
            echo -e "${YELLOW}📋 LLM lambda is self-contained with built-in features${NC}"
            # LLM lambda doesn't need external dependencies
            ;;
        "projects")
            echo -e "${YELLOW}📋 Projects lambda needs DynamoDB module${NC}"
            # Copy DynamoDB package for projects lambda
            cp -r "$BACKEND_ROOT/dynamodb" "$LAMBDA_BUILD_DIR/lambda_package/"
            ;;
        "requirements")
            echo -e "${YELLOW}📋 Requirements lambda needs DynamoDB module${NC}"
            # Copy DynamoDB package for requirements lambda
            cp -r "$BACKEND_ROOT/dynamodb" "$LAMBDA_BUILD_DIR/lambda_package/"
            ;;
        "waitlist")
            echo -e "${YELLOW}📋 Waitlist lambda needs DynamoDB module${NC}"
            # Copy DynamoDB package for waitlist lambda
            cp -r "$BACKEND_ROOT/dynamodb" "$LAMBDA_BUILD_DIR/lambda_package/"
            ;;
        *)
            echo -e "${YELLOW}📋 Copying all dependencies for unknown lambda type...${NC}"
            cp -r "$PROJECT_ROOT/features" "$LAMBDA_BUILD_DIR/lambda_package/"
            cp -r "$PROJECT_ROOT/local" "$LAMBDA_BUILD_DIR/lambda_package/"
            cp -r "$PROJECT_ROOT/iac" "$LAMBDA_BUILD_DIR/lambda_package/"
            cp -r "$PROJECT_ROOT/app-api/app" "$LAMBDA_BUILD_DIR/lambda_package/"
            ;;
    esac

    # Remove unnecessary files from the package
    echo -e "${YELLOW}🧹 Cleaning up unnecessary files...${NC}"
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "*.pyc" -delete
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "*.git*" -delete 2>/dev/null || true
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "test_*" -delete 2>/dev/null || true
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "local_test" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Explicitly remove boto3 and botocore since they're available in Lambda runtime
    echo -e "${YELLOW}🧹 Removing boto3 and botocore (available in Lambda runtime)...${NC}"
    
    # Remove boto3 and botocore packages and all related files
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "*boto3*" -type f -delete 2>/dev/null || true
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "*botocore*" -type f -delete 2>/dev/null || true
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "*boto3*" -type d -exec rm -rf {} + 2>/dev/null || true
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "*botocore*" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Also remove any AWS SDK related packages that might be pulled in
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "*aws*" -type f -delete 2>/dev/null || true
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "*aws*" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Remove any remaining boto3/botocore references
    rm -rf "$LAMBDA_BUILD_DIR/lambda_package/boto3" 2>/dev/null || true
    rm -rf "$LAMBDA_BUILD_DIR/lambda_package/botocore" 2>/dev/null || true
    rm -rf "$LAMBDA_BUILD_DIR/lambda_package/boto3-*" 2>/dev/null || true
    rm -rf "$LAMBDA_BUILD_DIR/lambda_package/botocore-*" 2>/dev/null || true
    rm -rf "$LAMBDA_BUILD_DIR/lambda_package/aws-*" 2>/dev/null || true
    
    # Remove any Python cache files that might contain boto3 references
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "*.pyc" -delete 2>/dev/null || true
    find "$LAMBDA_BUILD_DIR/lambda_package" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Verify boto3 and botocore are not in the package
    echo -e "${YELLOW}🔍 Verifying package contents...${NC}"
    if [ -d "$LAMBDA_BUILD_DIR/lambda_package/boto3" ]; then
        echo -e "${RED}❌ WARNING: boto3 still found in package!${NC}"
    else
        echo -e "${GREEN}✅ boto3 not found in package${NC}"
    fi
    
    if [ -d "$LAMBDA_BUILD_DIR/lambda_package/botocore" ]; then
        echo -e "${RED}❌ WARNING: botocore still found in package!${NC}"
    else
        echo -e "${GREEN}✅ botocore not found in package${NC}"
    fi
    
    # Show package size after cleanup
    PACKAGE_SIZE_AFTER_CLEANUP=$(du -sh "$LAMBDA_BUILD_DIR/lambda_package" | cut -f1)
    echo -e "${YELLOW}📏 Package size after cleanup: $PACKAGE_SIZE_AFTER_CLEANUP${NC}"
    echo -e "${YELLOW}📏 Size reduction: $PACKAGE_SIZE_BEFORE_CLEANUP → $PACKAGE_SIZE_AFTER_CLEANUP${NC}"
    
    # Show package size before zipping
    PACKAGE_SIZE_BEFORE=$(du -sh "$LAMBDA_BUILD_DIR/lambda_package" | cut -f1)
    echo -e "${YELLOW}📏 Package size before zipping: $PACKAGE_SIZE_BEFORE${NC}"

    # Create the deployment ZIP
    echo -e "${YELLOW}📦 Creating $LAMBDA_NAME deployment package...${NC}"
    cd "$LAMBDA_BUILD_DIR/lambda_package"
    zip -r "$DIST_DIR/$LAMBDA_NAME-deployment.zip" . -q

    # Get package size
    PACKAGE_SIZE=$(du -h "$DIST_DIR/$LAMBDA_NAME-deployment.zip" | cut -f1)

    # Final verification - check if boto3/botocore are in the ZIP
    echo -e "${YELLOW}🔍 Final verification of ZIP contents...${NC}"
    if unzip -l "$DIST_DIR/$LAMBDA_NAME-deployment.zip" | grep -q "boto3"; then
        echo -e "${RED}❌ WARNING: boto3 found in ZIP file!${NC}"
    else
        echo -e "${GREEN}✅ boto3 not found in ZIP file${NC}"
    fi
    
    if unzip -l "$DIST_DIR/$LAMBDA_NAME-deployment.zip" | grep -q "botocore"; then
        echo -e "${RED}❌ WARNING: botocore found in ZIP file!${NC}"
    else
        echo -e "${GREEN}✅ botocore not found in ZIP file${NC}"
    fi

    echo -e "${GREEN}✅ $LAMBDA_NAME deployment package created successfully!${NC}"
    echo -e "${GREEN}📦 Package: $DIST_DIR/$LAMBDA_NAME-deployment.zip${NC}"
    echo -e "${GREEN}📏 Size: $PACKAGE_SIZE${NC}"

    # Deactivate virtual environment
    deactivate 2>/dev/null || true
}

# Build Lambda packages based on selection
case $LAMBDA_TO_BUILD in
    auth|llm|projects|requirements|waitlist)
        build_lambda_package "$LAMBDA_TO_BUILD"
        ;;
    default)
        # Build default lambdas (auth, llm, projects, requirements)
        for lambda in "${DEFAULT_LAMBDAS[@]}"; do
            if [ -d "$BACKEND_ROOT/lambdas/$lambda" ]; then
                build_lambda_package "$lambda"
            else
                echo -e "${YELLOW}⚠️  Lambda directory for $lambda not found, skipping...${NC}"
            fi
        done
        ;;
    all)
        # Build all available lambdas
        for lambda in "${AVAILABLE_LAMBDAS[@]}"; do
            if [ -d "$BACKEND_ROOT/lambdas/$lambda" ]; then
                build_lambda_package "$lambda"
            else
                echo -e "${YELLOW}⚠️  Lambda directory for $lambda not found, skipping...${NC}"
            fi
        done
        ;;
esac

# Cleanup
echo -e "${YELLOW}🧹 Cleaning up temporary files...${NC}"
rm -rf "$BUILD_DIR"

# Show summary
echo -e "${GREEN}🎉 Lambda packages built successfully!${NC}"
echo -e "${GREEN}📦 Output directory: $DIST_DIR${NC}"

# List built packages
echo -e "${GREEN}📋 Built packages:${NC}"
for zip_file in "$DIST_DIR"/*.zip; do
    if [ -f "$zip_file" ]; then
        filename=$(basename "$zip_file")
        size=$(du -h "$zip_file" | cut -f1)
        echo -e "${GREEN}  📦 $filename ($size)${NC}"
    fi
done 