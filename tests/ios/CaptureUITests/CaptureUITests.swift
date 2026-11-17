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

        let plus = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", "Plus ↗")).firstMatch
        XCTAssertTrue(plus.waitForExistence(timeout: 35), app.debugDescription)
        plus.tap()
        let monthly = app.descendants(matching: .any)["訂閱月繳"].firstMatch
        let annual = app.descendants(matching: .any)["訂閱年繳"].firstMatch
        XCTAssertTrue(monthly.waitForExistence(timeout: 35), app.debugDescription)
        XCTAssertTrue(annual.isEnabled)

        let initialPrices = ["60", "390", "690"]
        for price in initialPrices {
            let label = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", price)).firstMatch
            XCTAssertTrue(label.exists, "StoreKit display price missing: \(price)")
        }
        let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screenshot.name = "plus-paywall-zh-TW"
        screenshot.lifetime = .keepAlways
        add(screenshot)

        monthly.tap()
        let active = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Plus 使用中")).firstMatch
        XCTAssertTrue(active.waitForExistence(timeout: 35), app.debugDescription)

        app.buttons["恢復購買"].tap()
        XCTAssertTrue(app.staticTexts["已恢復 Plus。"].waitForExistence(timeout: 30), app.debugDescription)
    }
}
