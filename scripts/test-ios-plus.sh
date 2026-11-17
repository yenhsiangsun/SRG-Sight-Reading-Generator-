#!/usr/bin/env bash
set -euo pipefail

output="$PWD/build/ios/plus-review"
mkdir -p "$output"
xcrun simctl list devices available --json > "$output/devices.json"
udid="$(python3 - "$output/devices.json" <<'PY'
import json, sys
devices = json.load(open(sys.argv[1]))["devices"]
for runtime in reversed(list(devices)):
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
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath "$output/app-derived" \
  ARCHS="$(uname -m)" CURRENT_PROJECT_VERSION=15 CODE_SIGNING_ALLOWED=NO build > "$output/app-build.log" 2>&1 || { tail -n 70 "$output/app-build.log"; exit 22; }
xcrun simctl bootstatus "$udid" -b || exit 23
xcrun simctl install "$udid" "$output/app-derived/Build/Products/Release-iphonesimulator/App.app" || exit 24
xcrun simctl status_bar "$udid" override --time '9:41' --batteryState unplugged --batteryLevel 100 || true

status=0
xcodebuild test -project tests/ios/NativeStoreCapture.xcodeproj -scheme NativeStoreCapture \
  -destination "platform=iOS Simulator,id=$udid" -derivedDataPath "$output/test-derived" \
  -resultBundlePath "$output/Plus.xcresult" -parallel-testing-enabled NO \
  -test-timeouts-enabled YES -default-test-execution-time-allowance 240 \
  CODE_SIGNING_ALLOWED=NO > "$output/storekit-test.log" 2>&1 || status=$?
tail -n 85 "$output/storekit-test.log"
if [[ -d "$output/Plus.xcresult" ]]; then
  xcrun xcresulttool export attachments --path "$output/Plus.xcresult" --output-path "$output/attachments" || { if [[ "$status" = 0 ]]; then exit 25; fi; }
fi
exit "$status"
