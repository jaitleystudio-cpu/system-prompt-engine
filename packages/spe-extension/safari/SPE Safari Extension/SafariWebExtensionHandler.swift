import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems[0] as! NSExtensionItem
        let message = item.userInfo?[SFExtensionMessageKey]
        os_log(.default, "SPE Safari WebExtension received message from JS: %@", String(describing: message))

        let response = NSExtensionItem()
        response.userInfo = [ SFExtensionMessageKey: [ "status": "OK", "companion": "SPE Safari Bridge 1.0" ] ]

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

}
