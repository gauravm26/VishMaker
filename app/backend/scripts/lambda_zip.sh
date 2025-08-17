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
    echo "  LAMBDA_NAME    Build specific lambda (auth, llm, projects, requirements, all, or default)"
    echo ""
    echo "Examples:"
    echo "  $0              # Build all available lambdas"
    echo "  $0 default      # Build default lambdas (auth, llm, projects, requirements)"
    echo "  $0 auth         # Build only auth lambda"
    echo "  $0 llm          # Build only llm lambda"
    echo "  $0 projects     # Build only projects lambda"
    echo "  $0 requirements # Build only requirements lambda"
    echo "  $0 all          # Build all lambdas"
    echo ""
}

# Parse command line arguments
LAMBDA_TO_BUILD="${1:-all}"

# Define available lambdas
AVAILABLE_LAMBDAS=("auth" "llm" "projects" "requirements")
DEFAULT_LAMBDAS=("auth" "llm" "projects" "requirements")  # Default lambdas to build

# Validate lambda selection
case $LAMBDA_TO_BUILD in
    auth|llm|projects|requirements|all|default)
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
BACKEND_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_ROOT")"
BUILD_DIR="$BACKEND_ROOT/scripts/.build"
DIST_DIR="$BACKEND_ROOT/scripts/dist"

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

    # Install dependencies
    echo -e "${YELLOW}📦 Installing $LAMBDA_NAME dependencies...${NC}"
    pip install --upgrade pip
    pip install -r "$LAMBDA_CODE_DIR/requirements.txt" -t "$LAMBDA_BUILD_DIR/lambda_package"

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
        *)
            echo -e "${YELLOW}📋 Copying all dependencies for unknown lambda type...${NC}"
            cp -r "$PROJECT_ROOT/features" "$LAMBDA_BUILD_DIR/lambda_package/"
            cp -r "$PROJECT_ROOT/local" "$LAMBDA_BUILD_DIR/lambda_package/"
            cp -r "$PROJECT_ROOT/infrastructure" "$LAMBDA_BUILD_DIR/lambda_package/"
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

    # Create the deployment ZIP
    echo -e "${YELLOW}📦 Creating $LAMBDA_NAME deployment package...${NC}"
    cd "$LAMBDA_BUILD_DIR/lambda_package"
    zip -r "$DIST_DIR/$LAMBDA_NAME-deployment.zip" . -q

    # Get package size
    PACKAGE_SIZE=$(du -h "$DIST_DIR/$LAMBDA_NAME-deployment.zip" | cut -f1)

    echo -e "${GREEN}✅ $LAMBDA_NAME deployment package created successfully!${NC}"
    echo -e "${GREEN}📦 Package: $DIST_DIR/$LAMBDA_NAME-deployment.zip${NC}"
    echo -e "${GREEN}📏 Size: $PACKAGE_SIZE${NC}"

    # Deactivate virtual environment
    deactivate 2>/dev/null || true
}

# Build Lambda packages based on selection
case $LAMBDA_TO_BUILD in
    auth|llm|projects|requirements)
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