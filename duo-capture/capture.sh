#!/usr/bin/env bash
set -euo pipefail
out="$PWD/build/duo"
mkdir -p "$out"
exec > >(tee "$out/capture.log") 2>&1
xcodebuild -version | tee "$out/toolchain.txt"
git rev-parse HEAD >> "$out/toolchain.txt"
xcrun simctl list devices available --json | tee "$out/devices.json"
udid="$(python3 -c 'import json, sys; d = json.load(open(sys.argv[1]))["devices"]; print(next((x["udid"] for runtime, devices in d.items() if runtime.endswith("iOS-27-1") for x in devices if x["name"] == "iPhone Duo" and x["isAvailable"]), ""))' "$out/devices.json")"
if [[ -z "$udid" ]]; then
  echo 'The Xcode 27.1 machine did not list an available iPhone Duo.'
  exit 1
fi
xcrun simctl bootstatus "$udid" -b
xcrun simctl spawn "$udid" defaults write NSGlobalDomain AppleLanguages -array zh-Hant-TW en
xcrun simctl spawn "$udid" defaults write NSGlobalDomain AppleLocale -string zh_TW
xcrun simctl shutdown "$udid"
xcrun simctl bootstatus "$udid" -b
xcrun simctl ui "$udid" appearance light
xcrun simctl status_bar "$udid" override --time '9:41' --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState unplugged --batteryLevel 100 || true
xcrun simctl io "$udid" enumerate | tee "$out/displays.txt"
derived="$out/derived-app"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$udid" -derivedDataPath "$derived" \
  CURRENT_PROJECT_VERSION=14 MARKETING_VERSION=1.0 CODE_SIGNING_ALLOWED=NO build > "$out/native-build.log" 2>&1 || { tail -n 100 "$out/native-build.log"; exit 1; }
app="$derived/Build/Products/Release-iphonesimulator/App.app"
test "$(/usr/libexec/PlistBuddy -c 'Print CFBundleVersion' "$app/Info.plist")" = 14
xcrun simctl install "$udid" "$app"
result="$out/Capture.xcresult"
test_status=0
xcodebuild test -project duo-capture/NativeStoreCapture.xcodeproj -scheme NativeStoreCapture \
  -destination "platform=iOS Simulator,id=$udid" -derivedDataPath "$out/derived-tests" \
  -resultBundlePath "$result" -parallel-testing-enabled NO -maximum-concurrent-test-simulator-destinations 1 \
  -test-timeouts-enabled YES -default-test-execution-time-allowance 420 \
  -maximum-test-execution-time-allowance 480 CODE_SIGNING_ALLOWED=NO \
  > "$out/native-capture.log" 2>&1 || test_status=$?
tail -n 90 "$out/native-capture.log"
if [[ -d "$result" ]]; then
  xcrun xcresulttool export attachments --path "$result" --output-path "$out/attachments"
fi
exit "$test_status"
