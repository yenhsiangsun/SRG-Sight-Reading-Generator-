#!/usr/bin/env bash
set -euo pipefail

output="$PWD/build/ios/plus-review"
mkdir -p "$output"
xcrun simctl list devices available --json > "$output/devices.json"
udid="$(python3 - "$output/devices.json" <<'PY'
import json, sys
devices = json.load(open(sys.argv[1]))["devices"]
preferred = ["com.apple.CoreSimulator.SimRuntime.iOS-26-2", "com.apple.CoreSimulator.SimRuntime.iOS-26-1"]
for runtime in dict.fromkeys(preferred + list(devices)):
    if runtime not in devices:
        continue
    for device in devices[runtime]:
        if device.get("isAvailable") and device["name"] in ("iPhone 17 Pro", "iPhone 16 Pro", "iPhone 17"):
            print(device["udid"])
            raise SystemExit
PY
)"
if [[ -z "$udid" ]]; then
  echo "No supported iPhone Simulator available"
  exit 1
fi

# Match the app icon normalization performed by the signed iOS workflow.
sips --resampleHeightWidth 1024 1024 ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
xcrun simctl bootstatus "$udid" -b || exit 23
xcrun simctl status_bar "$udid" override --time '9:41' --batteryState unplugged --batteryLevel 100 || true

status=0
xcodebuild test -project ios/App/App.xcodeproj -scheme TonecraftStoreKitEvidence \
  -destination "platform=iOS Simulator,id=$udid" -derivedDataPath "$output/test-derived" \
  -resultBundlePath "$output/Plus.xcresult" -parallel-testing-enabled NO \
  -test-timeouts-enabled YES -default-test-execution-time-allowance 240 \
  ARCHS="$(uname -m)" CURRENT_PROJECT_VERSION=15 CODE_SIGNING_ALLOWED=NO > "$output/storekit-test.log" 2>&1 || status=$?
tail -n 85 "$output/storekit-test.log"
if [[ -d "$output/Plus.xcresult" ]]; then
  xcrun xcresulttool export attachments --path "$output/Plus.xcresult" --output-path "$output/attachments" || { if [[ "$status" = 0 ]]; then exit 25; fi; }
fi
exit "$status"
