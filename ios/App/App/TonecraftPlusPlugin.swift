import Capacitor
import StoreKit
import UIKit

final class TonecraftBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(TonecraftPlusPlugin())
    }
}

@objc(TonecraftPlusPlugin)
final class TonecraftPlusPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "TonecraftPlusPlugin"
    let jsName = "TonecraftPlus"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "entitlement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "redeemCode", returnType: CAPPluginReturnPromise),
    ]

    private static let monthly = "com.yenhsiang.sightreadinggenerator.plus.monthly"
    private static let annual = "com.yenhsiang.sightreadinggenerator.plus.annual"
    private static let productIDs = Set([monthly, annual])
    private var transactionTask: Task<Void, Never>?
    @MainActor private var purchaseInProgress = false

    override func load() {
        transactionTask = Task { @MainActor [weak self] in
            for await result in StoreKit.Transaction.updates {
                guard let self, !Task.isCancelled else { return }
                switch result {
                case .verified(let transaction):
                    guard Self.productIDs.contains(transaction.productID) else { continue }
                    self.notifyListeners("subscriptionChanged", data: [:])
                    await transaction.finish()
                case .unverified:
                    self.notifyListeners("subscriptionChanged", data: [:])
                }
            }
        }
    }

    deinit {
        transactionTask?.cancel()
    }

    private func hasPlus() async -> Bool {
        for await result in StoreKit.Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               Self.productIDs.contains(transaction.productID),
               transaction.revocationDate == nil, !transaction.isUpgraded {
                return true
            }
        }
        return false
    }

    @objc func entitlement(_ call: CAPPluginCall) {
        Task { @MainActor in
            call.resolve(["active": await hasPlus()])
        }
    }

    @objc func products(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                let products = try await Product.products(for: Self.productIDs)
                var plans: [[String: String]] = []
                for product in products {
                    guard let subscription = product.subscription else { continue }
                    var plan = [
                        "id": product.id,
                        "period": product.id == Self.annual ? "year" : "month",
                        "price": product.displayPrice,
                    ]
                    if product.id == Self.annual,
                       let offer = subscription.introductoryOffer,
                       offer.paymentMode == .payUpFront,
                       offer.period.unit == .year, offer.period.value == 1, offer.periodCount == 1,
                       await subscription.isEligibleForIntroOffer {
                        plan["firstYearPrice"] = offer.displayPrice
                    }
                    plans.append(plan)
                }
                call.resolve(["plans": plans])
            } catch {
                call.reject("Unable to load subscriptions", "STORE_UNAVAILABLE")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), Self.productIDs.contains(id) else {
            call.reject("Unknown subscription", "UNKNOWN_PRODUCT")
            return
        }
        Task { @MainActor in
            guard !purchaseInProgress else {
                call.reject("A purchase is already in progress", "PURCHASE_IN_PROGRESS")
                return
            }
            purchaseInProgress = true
            defer { purchaseInProgress = false }
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    call.reject("Subscription unavailable", "STORE_UNAVAILABLE")
                    return
                }
                switch try await product.purchase() {
                case .success(let verification):
                    guard case .verified(let transaction) = verification,
                          Self.productIDs.contains(transaction.productID) else {
                        call.reject("Unable to verify purchase", "VERIFICATION_FAILED")
                        return
                    }
                    let active = await hasPlus()
                    await transaction.finish()
                    call.resolve(["status": active ? "purchased" : "pending", "active": active])
                    notifyListeners("subscriptionChanged", data: [:])
                case .pending:
                    call.resolve(["status": "pending"])
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                @unknown default:
                    call.reject("Unexpected purchase result", "STORE_UNAVAILABLE")
                }
            } catch {
                call.reject("Unable to complete purchase", "STORE_UNAVAILABLE")
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                try await AppStore.sync()
                call.resolve(["active": await hasPlus()])
                notifyListeners("subscriptionChanged", data: [:])
            } catch {
                call.reject("Unable to restore subscriptions", "STORE_UNAVAILABLE")
            }
        }
    }

    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = bridge?.viewController?.viewIfLoaded?.window?.windowScene else {
                call.reject("No active window", "STORE_UNAVAILABLE")
                return
            }
            do {
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve()
            } catch {
                call.reject("Unable to manage subscriptions", "STORE_UNAVAILABLE")
            }
        }
    }

    @objc func redeemCode(_ call: CAPPluginCall) {
        Task { @MainActor in
            if #available(iOS 16.0, *) {
                guard let scene = bridge?.viewController?.viewIfLoaded?.window?.windowScene else {
                    call.reject("No active window", "STORE_UNAVAILABLE")
                    return
                }
                do {
                    try await AppStore.presentOfferCodeRedeemSheet(in: scene)
                    call.resolve()
                } catch {
                    call.reject("Unable to redeem an offer code", "STORE_UNAVAILABLE")
                }
            } else {
                SKPaymentQueue.default().presentCodeRedemptionSheet()
                call.resolve()
            }
        }
    }
}
