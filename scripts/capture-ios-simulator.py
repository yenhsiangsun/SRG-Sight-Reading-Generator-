#!/usr/bin/env python3
"""Optional native Simulator homepage captures; never block a TestFlight upload.

The app is built from the same production web assets as the IPA. Captures are
unmodified simulator PNGs, not evidence of physical-device testing. Missing
runtimes or a simulator build failure are recorded as a skipped capture.
"""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import struct
import subprocess
import time


BUNDLE_ID = "com.yenhsiang.sightreadinggenerator"
SIZE_OPTIONS = {
    "iphone": {(1179, 2556), (1206, 2622)},
    "ipad": {(2064, 2752), (2048, 2732)},
}


def png_size(path):
    with path.open("rb") as stream:
        header = stream.read(24)
    if header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValueError("Simulator did not produce a valid PNG")
    return struct.unpack(">II", header[16:24])


def select_devices(document):
    available = [device for devices in document.get("devices", {}).values()
                 for device in devices if device.get("isAvailable", True)]
    result = {}
    # These models use the App Store's current medium iPhone and 13-inch iPad
    # portrait sizes. Validate the actual PNG rather than assuming a model size.
    for pattern in (r"^iPhone 17 Pro$", r"^iPhone 16 Pro$", r"^iPhone 16$"):
        found = next((device for device in reversed(available)
                      if re.search(pattern, device["name"])), None)
        if found:
            result["iphone"] = found
            break
    result["ipad"] = next((device for device in reversed(available)
                            if re.search(r"^iPad Pro 13-inch", device["name"])), None)
    return {family: device for family, device in result.items() if device}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path("build/ios/simulator-screenshots"))
    parser.add_argument("--timeout-seconds", type=int, default=900)
    args = parser.parse_args()
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + args.timeout_seconds
    report = {
        "generatedAtUTC": datetime.now(timezone.utc).isoformat(),
        "captureType": "Native iOS Simulator, Release configuration, homepage",
        "physicalDeviceTest": False,
        "screenshots": [],
        "notes": [],
    }
    booted_here = []
    log_path = output / "simulator-capture.log"
    with log_path.open("w", encoding="utf-8") as log:
        def run(command, timeout=None):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("Optional simulator capture reached its total time limit")
            completed = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                       text=True, timeout=min(remaining, timeout or remaining))
            log.write("$ " + " ".join(command) + "\n" + completed.stdout + "\n")
            log.flush()
            if completed.returncode:
                raise RuntimeError(f"Command failed ({completed.returncode}): {' '.join(command[:4])}")
            return completed.stdout

        try:
            devices = select_devices(json.loads(run(["xcrun", "simctl", "list", "devices", "available", "--json"], 30)))
            if not devices:
                raise RuntimeError("No supported iPhone/13-inch iPad Simulator runtimes are installed")
            derived = output / "DerivedData"
            run(["xcodebuild", "-project", "ios/App/App.xcodeproj", "-scheme", "App",
                 "-configuration", "Release", "-sdk", "iphonesimulator",
                 "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", str(derived),
                 "CODE_SIGNING_ALLOWED=NO", "build"])
            app = derived / "Build/Products/Release-iphonesimulator/App.app"
            if not app.is_dir():
                raise RuntimeError("Simulator App.app was not generated")
            for family in ("iphone", "ipad"):
                device = devices.get(family)
                if not device:
                    report["notes"].append(f"No supported {family} Simulator available")
                    continue
                udid = device["udid"]
                try:
                    if device.get("state") != "Booted":
                        run(["xcrun", "simctl", "boot", udid], 45)
                        booted_here.append(udid)
                    run(["xcrun", "simctl", "bootstatus", udid, "-b"], 150)
                    run(["xcrun", "simctl", "install", udid, str(app)], 90)
                    run(["xcrun", "simctl", "status_bar", udid, "override", "--time", "9:41",
                         "--batteryState", "charged", "--batteryLevel", "100"], 30)
                    run(["xcrun", "simctl", "launch", udid, BUNDLE_ID,
                         "-AppleLanguages", "(zh-Hant)", "-AppleLocale", "zh_TW"], 45)
                    # Native launch completes before WKWebView finishes its first
                    # render. This delay is for the optional capture only.
                    time.sleep(min(10, max(0, deadline - time.monotonic())))
                    file = output / f"{family}-home-zh-TW.png"
                    run(["xcrun", "simctl", "io", udid, "screenshot", str(file)], 30)
                    size = png_size(file)
                    accepted = size in SIZE_OPTIONS[family]
                    report["screenshots"].append({
                        "family": family, "simulator": device["name"], "file": file.name,
                        "width": size[0], "height": size[1],
                        "acceptedPortraitDimensions": accepted,
                        "visualReviewRequired": True,
                    })
                    if not accepted:
                        report["notes"].append(f"{family} capture does not fit the intended store slot; capture a supported native size before upload")
                except Exception as error:
                    report["notes"].append(f"{family} capture skipped: {error}")
        except Exception as error:
            report["notes"].append(f"Optional captures skipped: {error}")
        finally:
            for udid in booted_here:
                try:
                    subprocess.run(["xcrun", "simctl", "shutdown", udid], stdout=log,
                                   stderr=subprocess.STDOUT, timeout=30)
                except Exception:
                    pass
    report["status"] = "captured" if report["screenshots"] else "skipped"
    (output / "capture-inventory.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Optional Simulator captures: {report['status']} ({len(report['screenshots'])} PNGs)")
    for note in report["notes"]:
        print(note)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
