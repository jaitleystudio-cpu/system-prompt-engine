import SwiftUI
import SafariServices

@main
struct SPESafariCompanionApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(width: 440, height: 380)
        }
    }
}

struct ContentView: View {
    @State private var isEnabled = false

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "bolt.shield.fill")
                .resizable()
                .scaledToFit()
                .frame(width: 64, height: 64)
                .foregroundColor(.cyan)

            Text("SPE Safari Companion")
                .font(.title2)
                .fontWeight(.bold)

            Text("1-Click AI Power Prompts & Invariant Shield for ChatGPT, Claude & Gemini in Safari.")
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
                .padding(.horizontal)

            VStack(spacing: 8) {
                Button(action: openSafariPreferences) {
                    Label("Open Safari Extensions Preferences", systemImage: "gearshape.2")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.blue)

                Link("Visit SPE Studio ↗", destination: URL(string: "https://system-prompt-engine.io")!)
                    .font(.footnote)
            }
            .padding(.top, 10)
        }
        .padding(24)
    }

    func openSafariPreferences() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: "io.systempromptengine.safari.extension") { error in
            if let error = error {
                NSLog("Error opening Safari extension preferences: %@", error.localizedDescription)
            }
        }
    }
}
