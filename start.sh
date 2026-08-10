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
echo "  _  _______ __   ______ _____ ____  _  _"
echo " | |/ /  __ \\\ \ / /  _ \_   _/ __ \| || |"
echo " | ' /| |__) |\ V /| |_) || || |  | | || |"
echo " |  < |  _  /  | | |  _ < | || |  | | __  |"
echo " | . \| | \ \  | | | |_) || || |__| |   | |"
echo " |_|\_\_|  \_\ |_| |____/_____\____/|_| |_|"
echo -e "${CYAN}   🚀 Krypton DevOps Control Plane (v1.0.0)${NC}\n"

# Step 1: Detect Operating System & Environment
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

# Step 2: First-Time Frontend Setup (npm install & vite build)
echo -e "\n${CYAN}[2/4] Building web interface...${NC}"
if [ ! -d "web/node_modules" ]; then
    echo -e "${GOLD}  📦 First-time run detected: Installing frontend npm dependencies...${NC}"
    (cd web && npm install)
fi

echo -e "  ⚙️ Compiling frontend production bundle (Vite)..."
(cd web && npx vite build)
echo -e "${GREEN}  ✓ Web interface built successfully!${NC}"

# Step 3: Compile Go Backend Binary
echo -e "\n${CYAN}[3/4] Compiling Krypton Go backend binary...${NC}"
go build -o krypton ./cmd/krypton
echo -e "${GREEN}  ✓ Krypton binary compiled cleanly: ${BOLD}./krypton${NC}"

# Step 4: Launch Krypton Server
PORT=8443
echo -e "\n${GOLD}${BOLD}======================================================================${NC}"
echo -e "${GREEN}${BOLD}  ✨ Krypton Control Plane is Live!${NC}"
echo -e "${CYAN}  🌐 Access UI: ${BOLD}http://localhost:${PORT}${NC}"
echo -e "${GOLD}  Press Ctrl + C to stop the server${NC}"
echo -e "${GOLD}${BOLD}======================================================================${NC}\n"

exec ./krypton --port "${PORT}"
