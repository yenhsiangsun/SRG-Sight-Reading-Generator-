#!/usr/bin/env python3
"""Inspect the actual IPA before upload; this is not Xcode's Privacy Report.

Uses only Python's standard library and never reads signing credentials. Compare
the IPA with the web build from this same CI run, so a stale Capacitor copy or a
missing sample cannot silently reach TestFlight.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import plistlib
import sys
import zipfile


ARCHIVED_SAMPLE_DIRECTORIES = ("samples/erhu", "samples/erhu-bisa", "samples/pipa")
PRIVACY_URL = "https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-TW/privacy"
SUPPORT_URL = "https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-TW/support"


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inspect_ipa(ipa, web_root, expected_build, expected_version):
    errors = []
    report = {
        "reportType": "IPA binary and privacy manifest inventory",
        "notAnXcodePrivacyReport": True,
        "generatedAtUTC": datetime.now(timezone.utc).isoformat(),
        "sourceCommit": os.environ.get("CM_COMMIT", ""),
        "codemagicBuildId": os.environ.get("CM_BUILD_ID", ""),
        "ipa": ipa.name,
        "ipaSha256": sha256_file(ipa),
        "errors": errors,
    }
    with zipfile.ZipFile(ipa) as bundle:
        entries = {item.filename: item for item in bundle.infolist() if not item.is_dir()}
        roots = sorted({name.split("/", 2)[1] for name in entries
                        if name.startswith("Payload/") and ".app/" in name
                        and len(name.split("/", 2)) == 3})
        if len(roots) != 1:
            errors.append(f"Expected one Payload application, found {roots}")
            return report
        root = "Payload/" + roots[0] + "/"
        report["appBundle"] = roots[0]

        def load_plist(name):
            if name not in entries:
                errors.append(f"Missing plist: {name}")
                return {}
            try:
                return plistlib.loads(bundle.read(name))
            except (plistlib.InvalidFileException, ValueError) as error:
                errors.append(f"Invalid plist {name}: {error}")
                return {}

        info = load_plist(root + "Info.plist")
        report["bundleIdentifier"] = info.get("CFBundleIdentifier")
        report["version"] = info.get("CFBundleShortVersionString")
        report["build"] = info.get("CFBundleVersion")
        report["deviceFamilies"] = info.get("UIDeviceFamily", [])
        if report["bundleIdentifier"] != "com.yenhsiang.sightreadinggenerator":
            errors.append("Unexpected application bundle identifier")
        if str(report["build"]) != str(expected_build):
            errors.append(f"Build {report['build']} differs from CI build {expected_build}")
        if str(report["version"]) != str(expected_version):
            errors.append(f"Version {report['version']} differs from {expected_version}")
        if set(report["deviceFamilies"]) != {1, 2}:
            errors.append("Binary must support both iPhone (1) and iPad (2)")
        if not info.get("NSMicrophoneUsageDescription", "").strip():
            errors.append("Missing microphone permission explanation")
        report["permissionDescriptions"] = {
            key: value for key, value in info.items()
            if key.startswith("NS") and key.endswith("UsageDescription")
        }
        if info.get("ITSAppUsesNonExemptEncryption") is not False:
            errors.append("Export-compliance declaration changed; review before upload")

        config_name = root + "capacitor.config.json"
        if config_name not in entries:
            errors.append("Missing packaged Capacitor configuration")
            config = {}
        else:
            config = json.loads(bundle.read(config_name))
        server = config.get("server") or {}
        report["capacitorServer"] = server
        if server.get("url") or server.get("cleartext"):
            errors.append("Packaged app has a development/remote server override")

        public_prefix = root + "public/"
        packaged_web = {name[len(public_prefix):]: name for name in entries
                        if name.startswith(public_prefix)}
        web_files = sorted(path for path in web_root.rglob("*") if path.is_file())
        if not (web_root / "index.html").is_file() or not web_files:
            errors.append("Web build to compare is missing index.html")
        matched = 0
        for file in web_files:
            relative = file.relative_to(web_root).as_posix()
            packaged = packaged_web.get(relative)
            if packaged is None:
                errors.append(f"Web asset missing from IPA: {relative}")
            elif hashlib.sha256(bundle.read(packaged)).hexdigest() != sha256_file(file):
                errors.append(f"Web asset differs from this CI build: {relative}")
            else:
                matched += 1
        for relative in packaged_web:
            if any(relative == old or relative.startswith(old + "/")
                   for old in ARCHIVED_SAMPLE_DIRECTORIES):
                errors.append(f"Archived recording packaged in IPA: {relative}")
        required_web = ("index.html", "samples/CREDITS.txt", "capture-worklet.js")
        for relative in required_web:
            if relative not in packaged_web:
                errors.append(f"Required bundled asset missing: {relative}")
        compiled = b"\n".join(bundle.read(name) for relative, name in packaged_web.items()
                               if relative.startswith("assets/") and relative.endswith(".js"))
        for value in (PRIVACY_URL, SUPPORT_URL, "tonecraft.zhuoyin@gmail.com"):
            if value.encode("utf-8") not in compiled:
                errors.append(f"Published policy/contact missing from compiled app: {value}")
        audio = [name for name in packaged_web if name.startswith("samples/")
                 and Path(name).suffix.lower() in {".wav", ".mp3", ".ogg", ".m4a", ".flac"}]
        report["webAssets"] = {
            "buildFileCount": len(web_files), "matchedFiles": matched,
            "packagedFileCount": len(packaged_web), "audioFileCount": len(audio),
            "archivedDirectoriesExcluded": list(ARCHIVED_SAMPLE_DIRECTORIES),
        }

        manifests = []
        for name in sorted(entries):
            if name.startswith(root) and name.endswith("PrivacyInfo.xcprivacy"):
                document = load_plist(name)
                manifests.append({"path": name[len(root):], "contents": document})
                # A declaration change requires a fresh App Privacy review. API
                # categories/reasons are reported for review, not guessed here.
                if document.get("NSPrivacyTracking") or document.get("NSPrivacyTrackingDomains"):
                    errors.append(f"Tracking manifest changed: {name[len(root):]}")
                if document.get("NSPrivacyCollectedDataTypes"):
                    errors.append(f"Collected-data manifest changed: {name[len(root):]}")
        report["privacyManifests"] = manifests
        app_privacy = next((item["contents"] for item in manifests
                            if item["path"] == "PrivacyInfo.xcprivacy"), None)
        if app_privacy is None:
            errors.append("Application PrivacyInfo.xcprivacy is missing from the IPA")
        else:
            reasons = {item.get("NSPrivacyAccessedAPIType"): item.get("NSPrivacyAccessedAPITypeReasons", [])
                       for item in app_privacy.get("NSPrivacyAccessedAPITypes", [])}
            if "C617.1" not in reasons.get("NSPrivacyAccessedAPICategoryFileTimestamp", []):
                errors.append("Application file-timestamp API reason is missing")
        report["limitations"] = [
            "This inventory does not replace Xcode's aggregate Privacy Report or App Store validation.",
            "Passing does not verify physical-device sound, microphone calibration or safe-area layout.",
            "Sample source and license evidence is maintained separately in docs/audio-release-audit.md.",
        ]
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ipa", type=Path, required=True)
    parser.add_argument("--web-root", type=Path, default=Path("dist"))
    parser.add_argument("--expected-build", required=True)
    parser.add_argument("--expected-version", default="1.0")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = inspect_ipa(args.ipa, args.web_root, args.expected_build, args.expected_version)
    report["status"] = "failed" if report["errors"] else "passed"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"IPA inspection {report['status']}: {report.get('version')} ({report.get('build')})")
    print(f"Inventory: {args.output}")
    for error in report["errors"]:
        print(f"ERROR: {error}", file=sys.stderr)
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
