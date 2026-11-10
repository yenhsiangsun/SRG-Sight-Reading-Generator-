import XCTest

final class CaptureUITests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.yenhsiang.sightreadinggenerator")

    private struct MissingScreen: Error { let label: String }

    private func button(_ label: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS %@", label)).firstMatch
    }

    private func swipe(up: Bool) {
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.47, dy: up ? 0.68 : 0.30))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.47, dy: up ? 0.30 : 0.68))
        start.press(forDuration: 0.04, thenDragTo: end)
        Thread.sleep(forTimeInterval: 0.35)
    }

    private func tap(_ label: String) throws {
        let element = button(label)
        for attempt in 0..<16 {
            if element.exists && element.isHittable {
                element.tap()
                Thread.sleep(forTimeInterval: 0.8)
                return
            }
            if attempt > 0 { swipe(up: true) }
            else { _ = element.waitForExistence(timeout: 3) }
        }
        throw MissingScreen(label: label)
    }

    private func waitFor(_ label: String) throws {
        let query = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", label))
        guard query.firstMatch.waitForExistence(timeout: 30) else {
            throw MissingScreen(label: label)
        }
    }

    private func shot(_ name: String) {
        Thread.sleep(forTimeInterval: 1.2)
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testCaptureStoreScreens() throws {
        app.launchArguments = ["-AppleLanguages", "(zh-Hant-TW)", "-AppleLocale", "zh_TW"]
        app.launch()
        do {
            try waitFor("翻開今日練習")
            Thread.sleep(forTimeInterval: 8)
            shot("04-home-zh-TW")
            try tap("翻開今日練習")
            try waitFor("選擇你的樂器")
            shot("02-instruments-zh-TW")
            try tap("下一步")
            try waitFor("找到舒適的音域")
            shot("03-range-zh-TW")
            try tap("下一步")
            try waitFor("設計今天的挑戰")
            shot("05-difficulty-zh-TW")
            try tap("下一步")
            try waitFor("拍號與更多")
            try tap("開始視譜練習")
            try waitFor("播放樂譜")
            shot("01-practice-overview-zh-TW")
            try tap("專注讀譜")
            try waitFor("離開專注模式")
            shot("01-practice-focus-zh-TW")
        } catch {
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "diagnostic-hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
            shot("diagnostic-failure")
            throw error
        }
    }
}
