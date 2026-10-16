import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const base = path.dirname(fileURLToPath(import.meta.url));
const output = process.argv[2] ? path.resolve(process.argv[2]) : path.join(base, 'generated');
fs.mkdirSync(path.join(output, 'NativeStoreCapture.xcodeproj', 'xcshareddata', 'xcschemes'), {recursive:true});
fs.mkdirSync(path.join(output, 'CaptureUITests'), {recursive:true});

const swift = String.raw`import XCTest

final class CaptureUITests: XCTestCase {
    private let target = XCUIApplication(bundleIdentifier: "com.yenhsiang.sightreadinggenerator")
    private struct CaptureError: Error { let message: String }
    private enum Direction { case up, down }

    override func setUpWithError() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
    }

    private func button(_ text: String) -> XCUIElement {
        target.buttons.matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func text(_ value: String) -> XCUIElement {
        target.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", value)).firstMatch
    }

    private func swipe(_ direction: Direction) {
        let surface = target.webViews.firstMatch.exists ? target.webViews.firstMatch : target
        switch direction { case .up: surface.swipeUp(); case .down: surface.swipeDown() }
        Thread.sleep(forTimeInterval: 0.35)
    }

    @discardableResult
    private func reveal(_ element: XCUIElement, hint: Direction = .up, attempts: Int = 26) throws -> XCUIElement {
        for _ in 0..<attempts {
            if element.exists && element.isHittable { return element }
            if element.exists && element.frame.height > 0 {
                let above = element.frame.midY < target.frame.minY + 70
                swipe(above ? .down : .up)
            } else { swipe(hint) }
        }
        throw CaptureError(message: "Cannot reveal expected UI element: \(element)")
    }

    private func tap(_ label: String, hint: Direction = .up) throws {
        try reveal(button(label), hint: hint).tap()
        Thread.sleep(forTimeInterval: 1.1)
    }

    private func expect(_ label: String) throws {
        guard text(label).waitForExistence(timeout: 30) else {
            throw CaptureError(message: "Missing expected Traditional Chinese screen: \(label)")
        }
    }

    private func shot(_ name: String) {
        Thread.sleep(forTimeInterval: 2.0)
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testCaptureFiveProductScreens() throws {
        target.launch()
        guard target.wait(for: .runningForeground, timeout: 45) else {
            throw CaptureError(message: "Installed production app did not launch")
        }
        do {
            // No launch flags, WebView scripts, data injection or app-source changes.
            guard button("開始今日練習").waitForExistence(timeout: 45) else {
                throw CaptureError(message: "Home screen is not Traditional Chinese")
            }
            shot("store-05-home-zh-TW")
            try tap("開始今日練習")
            try expect("選擇你的樂器")
            try tap("鋼琴（88 鍵）")
            try reveal(text("選擇你的樂器"), hint: .down)
            shot("store-02-instruments-zh-TW")

            // These are the real setup navigation buttons, not deep-link fixtures.
            try tap("音域與譜表", hint: .down)
            try expect("找到舒適的音域")
            try tap("鋼琴基礎 C3–C6")
            try reveal(text("最低音"), hint: .down)
            shot("store-03-staff-range-zh-TW")

            try tap("難度與規則", hint: .down)
            try expect("設計今天的挑戰")
            try tap("初級")
            try tap("無升降記號")
            try reveal(text("音高難度"), hint: .down)
            shot("store-04-challenge-options-zh-TW")

            try tap("開始視譜練習")
            guard button("播放樂譜").waitForExistence(timeout: 45) else {
                throw CaptureError(message: "Normal score generation did not reach practice")
            }
            try tap("專注讀譜")
            guard button("離開專注模式").waitForExistence(timeout: 15) else {
                throw CaptureError(message: "Score focus did not open")
            }
            for _ in 0..<4 { swipe(.down) }
            try expect("鋼琴（88 鍵）")
            shot("store-01-musical-practice-zh-TW")
        } catch {
            let hierarchy = XCTAttachment(string: target.debugDescription)
            hierarchy.name = "diagnostic-accessibility-hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
            shot("diagnostic-failure-do-not-upload")
            throw error
        }
    }
}
`;

const pbx = `// !$*UTF8*$!
{
 archiveVersion = 1;
 classes = {};
 objectVersion = 56;
 objects = {
  A00000000000000000000001 = {isa = PBXBuildFile; fileRef = A00000000000000000000002; };
  A00000000000000000000002 = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CaptureUITests.swift; sourceTree = "<group>"; };
  A00000000000000000000003 = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = CaptureUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
  A00000000000000000000004 = {isa = PBXGroup; children = (A00000000000000000000005, A00000000000000000000006); sourceTree = "<group>"; };
  A00000000000000000000005 = {isa = PBXGroup; children = (A00000000000000000000002); path = CaptureUITests; sourceTree = "<group>"; };
  A00000000000000000000006 = {isa = PBXGroup; children = (A00000000000000000000003); name = Products; sourceTree = "<group>"; };
  A00000000000000000000007 = {isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (A00000000000000000000001); runOnlyForDeploymentPostprocessing = 0; };
  A00000000000000000000008 = {isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; };
  A00000000000000000000009 = {isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; };
  A00000000000000000000010 = {isa = PBXNativeTarget; buildConfigurationList = A00000000000000000000014; buildPhases = (A00000000000000000000007, A00000000000000000000008, A00000000000000000000009); buildRules = (); dependencies = (); name = CaptureUITests; productName = CaptureUITests; productReference = A00000000000000000000003; productType = "com.apple.product-type.bundle.ui-testing"; };
  A00000000000000000000011 = {isa = PBXProject; attributes = {BuildIndependentTargetsInParallel = YES; LastUpgradeCheck = 2600; TargetAttributes = {A00000000000000000000010 = {CreatedOnToolsVersion = 26.0; }; }; }; buildConfigurationList = A00000000000000000000013; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en, Base); mainGroup = A00000000000000000000004; productRefGroup = A00000000000000000000006; projectDirPath = ""; projectRoot = ""; targets = (A00000000000000000000010); };
  A00000000000000000000012 = {isa = XCBuildConfiguration; buildSettings = {CLANG_ENABLE_MODULES = YES; IPHONEOS_DEPLOYMENT_TARGET = 15.0; SDKROOT = iphoneos; SWIFT_VERSION = 5.0; }; name = Debug; };
  A00000000000000000000015 = {isa = XCBuildConfiguration; buildSettings = {ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES; CODE_SIGNING_ALLOWED = NO; ENABLE_TESTING_SEARCH_PATHS = YES; GENERATE_INFOPLIST_FILE = YES; IPHONEOS_DEPLOYMENT_TARGET = 15.0; LD_RUNPATH_SEARCH_PATHS = ("$(inherited)", "@executable_path/Frameworks", "@loader_path/Frameworks"); PRODUCT_BUNDLE_IDENTIFIER = com.tonecraft.capture.uitests; PRODUCT_NAME = "$(TARGET_NAME)"; SUPPORTED_PLATFORMS = iphonesimulator; SWIFT_VERSION = 5.0; TARGETED_DEVICE_FAMILY = "1,2"; }; name = Debug; };
  A00000000000000000000013 = {isa = XCConfigurationList; buildConfigurations = (A00000000000000000000012); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
  A00000000000000000000014 = {isa = XCConfigurationList; buildConfigurations = (A00000000000000000000015); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
 };
 rootObject = A00000000000000000000011;
}
`;

const scheme = `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.7">
 <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES">
  <BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="A00000000000000000000010" BuildableName="CaptureUITests.xctest" BlueprintName="CaptureUITests" ReferencedContainer="container:NativeStoreCapture.xcodeproj"/></BuildActionEntry></BuildActionEntries>
 </BuildAction>
 <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES">
  <Testables><TestableReference skipped="NO" parallelizable="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="A00000000000000000000010" BuildableName="CaptureUITests.xctest" BlueprintName="CaptureUITests" ReferencedContainer="container:NativeStoreCapture.xcodeproj"/></TestableReference></Testables>
 </TestAction>
</Scheme>
`;

fs.writeFileSync(path.join(output, 'CaptureUITests', 'CaptureUITests.swift'), swift);
fs.writeFileSync(path.join(output, 'NativeStoreCapture.xcodeproj', 'project.pbxproj'), pbx);
fs.writeFileSync(path.join(output, 'NativeStoreCapture.xcodeproj', 'xcshareddata', 'xcschemes', 'NativeStoreCapture.xcscheme'), scheme);

const definitions = [...pbx.matchAll(/^\s*(A[0-9A-F]{23}) = \{/gm)].map(match=>match[1]);
const ids = [...new Set(pbx.match(/A[0-9A-F]{23}/g))];
if(new Set(definitions).size!==definitions.length || ids.some(id=>!definitions.includes(id))) throw new Error('PBX object reference check failed');
for (const name of ['store-05-home-zh-TW','store-02-instruments-zh-TW','store-03-staff-range-zh-TW','store-04-challenge-options-zh-TW','store-01-musical-practice-zh-TW']) {
  if(!swift.includes('shot("'+name+'")')) throw new Error('Missing screenshot stage '+name);
}
if(swift.includes('evaluateJavaScript') || swift.includes('launchEnvironment') || swift.includes('launchArguments')) throw new Error('App state injection is forbidden');
console.log(JSON.stringify({output,generatedFiles:3,PBXReferencesChecked:ids.length,storeStages:5,nativeCompile:'not run on Windows',appSourceModified:false}));
