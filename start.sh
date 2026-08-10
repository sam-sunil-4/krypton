#!/usr/bin/env bash
# ==============================================================================
# Krypton DevOps Control Plane - 1-Click Automated Startup & Bootstrap Script
# ==============================================================================
set -e

# Colored Console Output Helpers
GREEN='\033[0;32m'
CYAN='\033[0;36m'
GOLD='\033[0;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${GOLD}${BOLD}"
cat << 'EOF'
 _  __    _____    __   __   _____    _____     ____     _   _ 
| |/ /   |  __ \   \ \ / /  |  __ \  |_   _|   / __ \   | \ | |
| ' /    | |__) |   \ V /   | |__) |   | |    | |  | |  |  \| |
|  <     |  _  /     | |    |  ___/    | |    | |  | |  | . ` |
| . \    | | \ \     | |    | |        | |    | |__| |  | |\  |
|_|\_\   |_|  \_\    |_|    |_|        |_|     \____/   |_| \_|
EOF
echo -e "${CYAN}   🚀 Krypton DevOps Control Plane (v1.0.0)"
echo -e "${GREEN}   ✨ Developed and maintained by Sam${NC}\n"

# Step 1: Ensure execution from root project directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${CYAN}[1/4] Checking prerequisites (Go & Node.js)...${NC}"

# Check Go
if ! command -v go &> /dev/null; then
    echo -e "${RED}❌ Error: Go (golang) is not installed!${NC}"
    echo -e "Please install Go 1.21+ (e.g., 'brew install go' on macOS or 'sudo apt install golang' on Linux) and re-run start.sh."
    exit 1
fi
GO_VERSION=$(go version | awk '{print $3}')
echo -e "${GREEN}  ✓ Found Go (${GO_VERSION})${NC}"

# Check Node / npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js / npm is not installed!${NC}"
    echo -e "Please install Node.js 18+ (e.g., 'brew install node' or visit https://nodejs.org) and re-run start.sh."
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}  ✓ Found Node.js (${NODE_VERSION})${NC}"

# Ensure web/dist exists so go:embed doesn't fail on fresh clones
mkdir -p web/dist

# Step 2: First-Time Frontend Setup (npm install & vite build)
echo -e "\n${CYAN}[2/4] Building web interface...${NC}"
if [ ! -d "web/node_modules" ]; then
    echo -e "${GOLD}  📦 First-time run detected: Installing frontend dependencies in web/...${NC}"
    (cd web && npm install)
fi

echo -e "  ⚙️ Compiling frontend production bundle (Vite)..."
(cd web && npx -y vite build)
echo -e "${GREEN}  ✓ Web interface built successfully!${NC}"

# Step 3: Compile Go Backend Binary
echo -e "\n${CYAN}[3/4] Compiling Krypton Go backend binary...${NC}"

if [ -f "cmd/krypton/main.go" ]; then
    go build -o krypton ./cmd/krypton/main.go
elif [ -d "cmd/krypton" ]; then
    go build -o krypton ./cmd/krypton
else
    echo -e "${RED}❌ Error: Could not find cmd/krypton entrypoint directory.${NC}"
    echo -e "Please ensure you are in the root directory of the repository and that 'cmd/krypton/main.go' exists."
    exit 1
fi

echo -e "${GREEN}  ✓ Krypton binary compiled cleanly: ${BOLD}./krypton${NC}"

# Step 4: Launch Krypton Server
PORT=8443
echo -e "\n${GOLD}${BOLD}======================================================================${NC}"
echo -e "${GREEN}${BOLD}  ✨ Krypton Control Plane is Live!${NC}"
echo -e "${CYAN}  🌐 Access UI: ${BOLD}http://localhost:${PORT}${NC}"
echo -e "${GOLD}  Press Ctrl + C to stop the server${NC}"
echo -e "${GOLD}${BOLD}======================================================================${NC}\n"

exec ./krypton --port "${PORT}"
