import StoreKitTest
import XCTest

final class CaptureUITests: XCTestCase {
    @MainActor
    func testPlusPricingAndPurchase() throws {
        continueAfterFailure = false
        let fixture = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "Plus", withExtension: "storekit"))
        let session = try SKTestSession(contentsOf: fixture)
        session.resetToDefaultState()
        session.disableDialogs = true
        session.clearTransactions()
        addTeardownBlock { session.clearTransactions() }

        let app = XCUIApplication(bundleIdentifier: "com.yenhsiang.sightreadinggenerator")
        app.launchArguments = ["-AppleLanguages", "(zh-Hant-TW)", "-AppleLocale", "zh_TW"]
        app.launch()

        func element(_ label: String) -> XCUIElement {
            app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
        }
        func hit(_ item: XCUIElement) {
            let frame = item.frame
            let origin = app.frame.origin
            app.coordinate(withNormalizedOffset: .zero)
                .withOffset(CGVector(dx: frame.midX - origin.x, dy: frame.midY - origin.y)).tap()
        }
        func photo(_ name: String) {
            let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            attachment.name = name
            attachment.lifetime = .keepAlways
            add(attachment)
        }

        let plus = element("Plus ↗")
        let title = element("琢音 Plus")
        XCTAssertTrue(plus.waitForExistence(timeout: 35), app.debugDescription)
        hit(plus)
        if !title.waitForExistence(timeout: 4) {
            let secondary = app.buttons["探索會員方案"]
            for _ in 0..<5 where !secondary.isHittable { app.swipeUp() }
            if secondary.isHittable { secondary.tap() }
        }
        if !title.waitForExistence(timeout: 8) { photo("diagnostic-plus-navigation") }
        XCTAssertTrue(title.exists, app.debugDescription)
        let monthly = element("訂閱月繳")
        let annual = element("訂閱年繳")
        if !monthly.waitForExistence(timeout: 20) { photo("diagnostic-storekit-catalog") }
        XCTAssertTrue(monthly.exists, app.debugDescription)
        XCTAssertTrue(annual.isEnabled)
        for price in ["60", "390", "690"] {
            let label = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", price)).firstMatch
            if !label.exists { photo("diagnostic-missing-price-\(price)") }
            XCTAssertTrue(label.exists, "StoreKit display price missing: \(price)")
        }
        photo("plus-paywall-zh-TW")

        hit(monthly)
        let active = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Plus 使用中")).firstMatch
        if !active.waitForExistence(timeout: 20) { photo("diagnostic-purchase") }
        XCTAssertTrue(active.exists, app.debugDescription)
        let restore = element("恢復購買")
        hit(restore)
        XCTAssertTrue(element("已恢復 Plus。").waitForExistence(timeout: 18), app.debugDescription)
    }
}
