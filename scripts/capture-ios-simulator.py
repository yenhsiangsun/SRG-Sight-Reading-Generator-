#!/usr/bin/env python3
"""Optional native Simulator homepage captures; never block a TestFlight upload.

The app is built from the same production web assets as the IPA. Captures are
unmodified simulator PNGs, not evidence of physical-device testing. Missing
runtimes or a simulator build failure are recorded as a skipped capture.
"""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import platform
import plistlib
import re
import struct
import subprocess
import time


BUNDLE_ID = "com.yenhsiang.sightreadinggenerator"
SIZE_OPTIONS = {
    "iphone": {(1179, 2556), (1206, 2622)},
    "ipad": {(2064, 2752), (2048, 2732)},
}
APP_SOURCE_PATHS = ("src", "public", "index.html", "capacitor.config.ts", "package.json",
                    "package-lock.json", "vite.config.ts", "build", "ios")


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


def enumerate_devices(run, output, report):
    """Allow one bounded cold CoreSimulator startup, without resetting devices."""
    command = ["xcrun", "simctl", "list", "devices", "available", "--json"]
    attempts = report.setdefault("deviceEnumeration", [])

    def diagnostics(stage, warmup=False):
        checks = [
            ("simctl-path", ["xcrun", "--find", "simctl"], 15),
            ("processes", ["ps", "-axo", "pid,ppid,state,etime,comm"], 20),
            ("memory", ["vm_stat"], 15),
        ]
        if warmup:
            # Asking the official runtime inventory can finish warming the
            # service/runtime mount after a cold VM's first request timed out.
            checks.append(("runtimes", ["xcrun", "simctl", "list", "runtimes", "--json"], 90))
        for name, diagnostic_command, timeout in checks:
            file = output / f"core-simulator-{stage}-{name}.log"
            try:
                file.write_text(run(diagnostic_command, timeout), encoding="utf-8")
            except Exception as error:
                # Main command logging also retains partial stdout on timeout.
                file.write_text(f"Diagnostic unavailable: {error}\n", encoding="utf-8")
                report["notes"].append(f"{stage} {name} diagnostic unavailable: {error}")

    for number, timeout in enumerate((180, 120), 1):
        try:
            text = run(command, timeout)
            document = json.loads(text)
            (output / "available-simulator-devices.json").write_text(text, encoding="utf-8")
            attempts.append({"attempt": number, "timeoutSeconds": timeout, "status": "completed"})
            return document
        except subprocess.TimeoutExpired:
            attempts.append({"attempt": number, "timeoutSeconds": timeout, "status": "timed_out"})
            report["notes"].append(f"CoreSimulator device enumeration attempt {number} timed out after {timeout}s")
            diagnostics(f"attempt-{number}", warmup=number == 1)
            if number == 2:
                raise


def capture_device(family, device, app, output, run, report, pause=time.sleep):
    """One device at a time, including cleanup after timeout or partial launch."""
    udid = device["udid"]
    base = ["xcrun", "simctl"]

    def note(message):
        report["notes"].append(f"{family}: {message}")

    def candidate(reason):
        # A screenshot after a timed-out launch can be SpringBoard, a splash
        # screen, or a partial app render. Never count it as a store capture.
        number = 1 + sum(item["family"] == family for item in report["candidates"])
        file = output / f"{family}-launch-timeout-candidate-{number}.png"
        try:
            processes = run(base + ["spawn", udid, "launchctl", "list"], 60)
            file.with_suffix(".processes.log").write_text(processes, encoding="utf-8")
        except Exception as error:
            note(f"Launch process observation unavailable: {error}")
        try:
            run(base + ["io", udid, "screenshot", str(file)], 60)
            width, height = png_size(file)
            report["candidates"].append({"family": family, "file": file.name,
                "width": width, "height": height, "reason": reason,
                "appLaunchConfirmed": False, "eligibleForStoreUpload": False,
                "visualReviewRequired": True})
        except Exception as error:
            note(f"Candidate screenshot unavailable: {error}")

    try:
        if device.get("state") != "Booted":
            run(base + ["boot", udid], 90)
        run(base + ["bootstatus", udid, "-b"], 420)
        run(base + ["install", udid, str(app)], 180)
        try:
            run(base + ["status_bar", udid, "override", "--time", "9:41",
                        "--batteryState", "charged", "--batteryLevel", "100"], 60)
        except Exception as error:
            note(f"Status bar override unavailable: {error}")
        pause(8)
        arguments = [BUNDLE_ID, "-AppleLanguages", "(zh-Hant)", "-AppleLocale", "zh_TW"]
        try:
            run(base + ["launch", udid] + arguments, 120)
        except subprocess.TimeoutExpired:
            note("First launch timed out; observing processes and preserving an unconfirmed candidate before retry")
            candidate("Initial simctl launch timed out")
            pause(10)
            try:
                run(base + ["launch", "--terminate-running-process", udid] + arguments, 180)
            except subprocess.TimeoutExpired:
                candidate("Retry simctl launch timed out")
                raise
        # Native launch completes before WKWebView's first render. Captures
        # still need human review even after a successful launch response.
        pause(15)
        file = output / f"{family}-home-zh-TW.png"
        run(base + ["io", udid, "screenshot", str(file)], 60)
        size = png_size(file)
        accepted = size in SIZE_OPTIONS[family]
        report["screenshots"].append({
            "family": family, "simulator": device["name"], "file": file.name,
            "width": size[0], "height": size[1], "appLaunchConfirmed": True,
            "acceptedPortraitDimensions": accepted, "visualReviewRequired": True,
            "eligibleForStoreUpload": False,
        })
        if not accepted:
            note("Capture does not fit the intended store slot; obtain a supported native size before upload")
    except Exception as error:
        note(f"Capture unavailable: {error}")
    finally:
        # Cleanup has its own bounded allowance even if the capture deadline
        # expired. Never leave the first Simulator running while booting the next.
        try:
            run(base + ["shutdown", udid], 90, cleanup=True)
        except Exception as error:
            note(f"Simulator shutdown unavailable: {error}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path("build/ios/simulator-screenshots"))
    parser.add_argument("--timeout-seconds", type=int, default=900)
    parser.add_argument("--family", choices=("all", "iphone", "ipad"), default="all")
    parser.add_argument("--build-number")
    parser.add_argument("--marketing-version")
    parser.add_argument("--app-source-commit")
    parser.add_argument("--require-capture", action="store_true",
                        help="Fail a dedicated screenshot job if no confirmed-launch capture was produced")
    args = parser.parse_args()
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + args.timeout_seconds
    report = {
        "generatedAtUTC": datetime.now(timezone.utc).isoformat(),
        "captureType": "Native iOS Simulator, Release configuration, homepage",
        "physicalDeviceTest": False,
        "screenshots": [],
        "candidates": [],
        "notes": [],
        "requestedFamily": args.family,
        "automationBranch": os.environ.get("CM_BRANCH", ""),
        "codemagicBuildId": os.environ.get("CM_BUILD_ID", ""),
    }
    log_path = output / "simulator-capture.log"
    with log_path.open("w", encoding="utf-8") as log:
        def progress(message):
            line = datetime.now(timezone.utc).isoformat(timespec="seconds") + " " + message
            print(line, flush=True)
            log.write(line + "\n")
            log.flush()

        def run(command, timeout=None, cleanup=False):
            remaining = deadline - time.monotonic()
            if remaining <= 0 and not cleanup:
                raise TimeoutError("Optional simulator capture reached its total time limit")
            allowance = (timeout or 90) if cleanup else min(remaining, timeout or remaining)
            started = time.monotonic()
            progress(f"Starting ({int(allowance)}s limit): {' '.join(command)}")
            try:
                completed = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                           text=True, timeout=allowance)
            except subprocess.TimeoutExpired as error:
                partial = error.stdout or ""
                if isinstance(partial, bytes):
                    partial = partial.decode("utf-8", errors="replace")
                log.write(partial + "\n")
                progress(f"Timed out after {int(time.monotonic()-started)}s: {' '.join(command[:4])}")
                raise
            log.write(completed.stdout + "\n")
            log.flush()
            progress(f"Finished ({completed.returncode}) after {int(time.monotonic()-started)}s")
            if completed.returncode:
                raise RuntimeError(f"Command failed ({completed.returncode}): {' '.join(command[:4])}")
            return completed.stdout

        try:
            report["automationCommit"] = run(["git", "rev-parse", "HEAD"], 30).strip()
            if args.app_source_commit:
                reference = run(["git", "rev-parse", args.app_source_commit], 30).strip()
                changed = run(["git", "diff", "--name-only", reference, "HEAD", "--"] + list(APP_SOURCE_PATHS), 30).splitlines()
                report["appSourceComparison"] = {"referenceCommit": reference, "changedPaths": changed,
                    "comparedPaths": list(APP_SOURCE_PATHS),
                    "limitation": "Matching App source does not make the unsigned Simulator binary identical to the signed TestFlight IPA."}
                if changed:
                    raise RuntimeError("App source differs from the reference TestFlight commit; review before using screenshots")
            devices = select_devices(enumerate_devices(run, output, report))
            if args.family != "all":
                devices = {family: device for family, device in devices.items() if family == args.family}
            if not devices:
                raise RuntimeError("No supported iPhone/13-inch iPad Simulator runtimes are installed")
            derived = output / "DerivedData"
            build_command = ["xcodebuild", "-project", "ios/App/App.xcodeproj", "-scheme", "App",
                 "-configuration", "Release", "-sdk", "iphonesimulator",
                 "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", str(derived),
                 "CODE_SIGNING_ALLOWED=NO"]
            if platform.machine() == "arm64":
                build_command += ["ARCHS=arm64", "ONLY_ACTIVE_ARCH=YES"]
            if args.build_number:
                build_command.append("CURRENT_PROJECT_VERSION=" + args.build_number)
            if args.marketing_version:
                build_command.append("MARKETING_VERSION=" + args.marketing_version)
            run(build_command + ["build"])
            app = derived / "Build/Products/Release-iphonesimulator/App.app"
            if not app.is_dir():
                raise RuntimeError("Simulator App.app was not generated")
            info = plistlib.loads((app / "Info.plist").read_bytes())
            report["simulatorApp"] = {"build": info.get("CFBundleVersion"),
                "version": info.get("CFBundleShortVersionString"), "bundleIdentifier": info.get("CFBundleIdentifier")}
            if args.build_number and str(info.get("CFBundleVersion")) != args.build_number:
                raise RuntimeError("Simulator build number differs from the requested TestFlight version")
            if args.marketing_version and str(info.get("CFBundleShortVersionString")) != args.marketing_version:
                raise RuntimeError("Simulator marketing version differs from the requested TestFlight version")
            families = ("iphone", "ipad") if args.family == "all" else (args.family,)
            for family in families:
                device = devices.get(family)
                if not device:
                    report["notes"].append(f"No supported {family} Simulator available")
                    continue
                progress(f"Capturing {family}: {device['name']}")
                capture_device(family, device, app, output, run, report)
                (output / "capture-inventory.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        except Exception as error:
            report["notes"].append(f"Optional captures skipped: {error}")
    report["status"] = "captured" if report["screenshots"] else "skipped"
    (output / "capture-inventory.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Optional Simulator captures: {report['status']} ({len(report['screenshots'])} PNGs, {len(report['candidates'])} unconfirmed candidates)", flush=True)
    for note in report["notes"]:
        print(note)
    return 1 if args.require_capture and not report["screenshots"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
