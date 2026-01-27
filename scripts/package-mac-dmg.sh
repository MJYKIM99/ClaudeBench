#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="Claude Bench"
BUNDLE_ID="com.claudebench.desktop"
TEAM_ID="2Z66884GZ3"
CERTIFICATE="Developer ID Application: Shanghai TacticSpace Technology Co., Ltd. (2Z66884GZ3)"
NOTARY_PROFILE="claudebench-notary"

# Paths
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/src-tauri/target/release"
APP_PATH="$BUILD_DIR/bundle/macos/$APP_NAME.app"
DMG_NAME="${APP_NAME// /_}_$(grep '"version"' "$PROJECT_DIR/package.json" | head -1 | awk -F'"' '{print $4}')_$(uname -m)"
DMG_PATH="$BUILD_DIR/bundle/dmg/$DMG_NAME.dmg"

echo -e "${GREEN}=== ClaudeBench DMG Signing & Notarization ===${NC}"
echo "App: $APP_PATH"
echo "DMG: $DMG_PATH"
echo ""

# Step 1: Check certificate
echo -e "${YELLOW}[1/5] Checking code signing certificate...${NC}"
if security find-identity -v -p codesigning | grep -q "$TEAM_ID"; then
    echo -e "${GREEN}✓ Certificate found${NC}"
else
    echo -e "${RED}✗ Developer ID Application certificate not found!${NC}"
    echo "Please install the certificate from developer.apple.com"
    exit 1
fi

# Step 2: Sign the app
echo -e "${YELLOW}[2/5] Signing the app...${NC}"
if [ -d "$APP_PATH" ]; then
    codesign --force --deep --options runtime \
        --entitlements "$PROJECT_DIR/src-tauri/entitlements.plist" \
        --sign "$CERTIFICATE" \
        "$APP_PATH"

    # Verify
    if codesign --verify --verbose "$APP_PATH" 2>&1 | grep -q "valid on disk"; then
        echo -e "${GREEN}✓ App signed successfully${NC}"
    else
        echo -e "${RED}✗ App signing failed${NC}"
        codesign --verify --verbose "$APP_PATH" 2>&1
        exit 1
    fi
else
    echo -e "${RED}✗ App not found at $APP_PATH${NC}"
    echo "Run 'npm run tauri build' first"
    exit 1
fi

# Step 3: Create DMG with drag-to-install UI
echo -e "${YELLOW}[3/5] Creating DMG...${NC}"
DMG_SRC_DIR=$(mktemp -d)
cp -R "$APP_PATH" "$DMG_SRC_DIR/"
ln -s /Applications "$DMG_SRC_DIR/Applications"

# Remove existing DMG if any
rm -f "$DMG_PATH"

hdiutil create -volname "$APP_NAME" \
    -srcfolder "$DMG_SRC_DIR" \
    -ov -format UDZO -imagekey zlib-level=9 \
    "$DMG_PATH"

rm -rf "$DMG_SRC_DIR"
echo -e "${GREEN}✓ DMG created: $DMG_PATH${NC}"

# Step 4: Sign the DMG
echo -e "${YELLOW}[4/5] Signing the DMG...${NC}"
codesign --sign "$CERTIFICATE" "$DMG_PATH"

if codesign --verify --verbose "$DMG_PATH" 2>&1 | grep -q "valid on disk"; then
    echo -e "${GREEN}✓ DMG signed successfully${NC}"
else
    echo -e "${RED}✗ DMG signing failed${NC}"
    exit 1
fi

# Step 5: Notarization
echo -e "${YELLOW}[5/5] Notarizing DMG...${NC}"
echo "This requires your Apple ID and app-specific password"

# Check if notary profile exists
if security find-generic-password -s "notarytool-password" -a "$NOTARY_PROFILE" &>/dev/null; then
    echo "Using stored credentials for notarytool"
    SUBMISSION_OUTPUT=$(xcrun notarytool submit "$DMG_PATH" \
        --keychain-profile "$NOTARY_PROFILE" \
        --wait 2>&1)
else
    echo "No stored credentials found. Please enter:"
    read -p "Apple ID: " APPLE_ID
    read -sp "App-Specific Password: " APP_PASSWORD
    echo ""

    SUBMISSION_OUTPUT=$(xcrun notarytool submit "$DMG_PATH" \
        --apple-id "$APPLE_ID" \
        --password "$APP_PASSWORD" \
        --team-id "$TEAM_ID" \
        --wait 2>&1)

    # Ask if user wants to store credentials
    read -p "Store credentials for future use? (y/N): " STORE_CREDS
    if [[ "$STORE_CREDS" =~ ^[Yy]$ ]]; then
        xcrun notarytool store-credentials "$NOTARY_PROFILE" \
            --apple-id "$APPLE_ID" \
            --password "$APP_PASSWORD" \
            --team-id "$TEAM_ID"
        echo -e "${GREEN}✓ Credentials stored${NC}"
    fi
fi

# Check submission result
if echo "$SUBMISSION_OUTPUT" | grep -q "status: Accepted"; then
    echo -e "${GREEN}✓ Notarization accepted${NC}"
else
    echo -e "${RED}✗ Notarization failed${NC}"
    echo "$SUBMISSION_OUTPUT"
    exit 1
fi

# Step 6: Staple the ticket
echo -e "${YELLOW}[6/6] Stapling notarization ticket...${NC}"
xcrun stapler staple "$DMG_PATH"

# Final verification
echo ""
echo -e "${GREEN}=== Final Verification ===${NC}"

if xcrun stapler validate "$DMG_PATH" 2>&1 | grep -q "is stapled"; then
    echo -e "${GREEN}✓ DMG is stapled${NC}"
else
    echo -e "${YELLOW}⚠ Staple validation failed (may be OK)${NC}"
fi

if spctl --assess --type open "$DMG_PATH" 2>&1; then
    echo -e "${GREEN}✓ DMG passes Gatekeeper check${NC}"
else
    echo -e "${YELLOW}⚠ Gatekeeper assessment warning${NC}"
fi

echo ""
echo -e "${GREEN}=== Done! ===${NC}"
echo "Signed & Notarized DMG: $DMG_PATH"
ls -lh "$DMG_PATH"
