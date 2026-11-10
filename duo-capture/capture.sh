#!/usr/bin/env bash
set -euo pipefail
root="$PWD/build/capture"
mkdir -p "$root/shared"
exec > >(tee "$root/shared/capture.log") 2>&1
xcodebuild -version | tee "$root/shared/toolchain.txt"
git rev-parse HEAD >> "$root/shared/toolchain.txt"
xcrun simctl list devices available --json | tee "$root/shared/devices.json"

if [[ "${1:?missing capture group}" == duo ]]; then
  models=('iPhone Duo')
else
  models=('iPhone 17 Pro' 'iPad Pro 13-inch (M5)')
fi
derived="$root/derived-app"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath "$derived" \
  CURRENT_PROJECT_VERSION=14 MARKETING_VERSION=1.0 CODE_SIGNING_ALLOWED=NO build \
  > "$root/shared/native-build.log" 2>&1 || { tail -n 100 "$root/shared/native-build.log"; exit 1; }
app="$derived/Build/Products/Release-iphonesimulator/App.app"
test "$(/usr/libexec/PlistBuddy -c 'Print CFBundleVersion' "$app/Info.plist")" = 14

capture() {
  local model="$1" udid out result test_status=0
  udid="$(python3 -c 'import json, sys; d = json.load(open(sys.argv[1]))["devices"]; print(next((x["udid"] for devices in d.values() for x in devices if x["name"] == sys.argv[2] and x["isAvailable"]), ""))' "$root/shared/devices.json" "$model")"
  if [[ -z "$udid" ]]; then
    echo "The build machine did not list an available $model."
    return 1
  fi
  case "$model" in
    'iPhone Duo') out="$root/iphone-duo" ;;
    'iPhone 17 Pro') out="$root/iphone-6-3" ;;
    'iPad Pro 13-inch (M5)') out="$root/ipad-13" ;;
  esac
  mkdir -p "$out"
  xcrun simctl bootstatus "$udid" -b || return
  xcrun simctl spawn "$udid" defaults write NSGlobalDomain AppleLanguages -array zh-Hant-TW en || return
  xcrun simctl spawn "$udid" defaults write NSGlobalDomain AppleLocale -string zh_TW || return
  xcrun simctl shutdown "$udid" || return
  xcrun simctl bootstatus "$udid" -b || return
  xcrun simctl ui "$udid" appearance light || true
  xcrun simctl status_bar "$udid" override --time '9:41' --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState unplugged --batteryLevel 100 || true
  xcrun simctl io "$udid" enumerate | tee "$out/displays.txt" || true
  xcrun simctl install "$udid" "$app" || return
  result="$out/Capture.xcresult"
  xcodebuild test -project duo-capture/NativeStoreCapture.xcodeproj -scheme NativeStoreCapture \
    -destination "platform=iOS Simulator,id=$udid" -derivedDataPath "$out/derived-tests" \
    -resultBundlePath "$result" -parallel-testing-enabled NO -maximum-concurrent-test-simulator-destinations 1 \
    -test-timeouts-enabled YES -default-test-execution-time-allowance 420 \
    -maximum-test-execution-time-allowance 480 CODE_SIGNING_ALLOWED=NO \
    > "$out/native-capture.log" 2>&1 || test_status=$?
  tail -n 90 "$out/native-capture.log"
  if [[ -d "$result" ]]; then
    xcrun xcresulttool export attachments --path "$result" --output-path "$out/attachments" || return
  fi
  xcrun simctl shutdown "$udid" || true
  return "$test_status"
}

overall=0
for model in "${models[@]}"; do
  capture "$model" || overall=1
done
exit "$overall"
