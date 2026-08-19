import SwiftUI

struct NativeChatView: View {
    let agent: AgentSummary
    let baseURL: URL
    @StateObject private var store = ChatStore()
    @State private var draft = ""
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            if let error = store.error { ErrorBanner(message: error) }
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        if store.isLoading { ProgressView().padding() }
                        ForEach(store.events) { event in EventBubble(event: event).id(event.id) }
                    }
                    .padding(.horizontal, 12).padding(.vertical, 14)
                }
                .defaultScrollAnchor(.bottom)
                .onChange(of: store.events.count) { _, _ in if let last = store.events.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } } }
            }
            Composer(text: $draft, focused: $focused, sending: store.isSending, running: store.isRunning, send: send, stop: stop)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(agent.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .principal) { VStack(spacing: 1) { Text(agent.title).font(.headline).lineLimit(1); Text(store.isRunning ? "Working…" : agent.model).font(.caption2).foregroundStyle(store.isRunning ? .green : .secondary) } } }
        .task { await store.start(baseURL: baseURL, agentID: agent.id) }
        .onDisappear { store.stopPolling() }
    }

    private func send() { let value = draft; Task { if await store.send(value, baseURL: baseURL, agentID: agent.id) { draft = "" } } }
    private func stop() { Task { await store.stop(baseURL: baseURL, agentID: agent.id) } }
}

private struct EventBubble: View {
    let event: MobileEvent
    private var isUser: Bool { event.type == "user" }
    private var isTool: Bool { event.type == "tool_call" || event.type == "tool_result" }
    var body: some View {
        HStack(alignment: .bottom) {
            if isUser { Spacer(minLength: 54) }
            if isTool {
                Label(event.name ?? "Tool", systemImage: event.isError ? "exclamationmark.triangle" : "wrench.and.screwdriver").font(.caption).foregroundStyle(event.isError ? .red : .secondary).padding(.horizontal, 10).padding(.vertical, 7).background(.thinMaterial, in: Capsule())
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    if let text = event.text, !text.isEmpty { NativeMessageText(text: text) }
                    ForEach(Array(event.attachments.enumerated()), id: \.offset) { _, attachment in Label(attachment.name ?? "Attachment", systemImage: "paperclip").font(.caption) }
                }
                .padding(.horizontal, 13).padding(.vertical, 10)
                .background(isUser ? Color.accentColor : (event.type == "error" ? Color.red.opacity(0.13) : Color(.secondarySystemGroupedBackground)), in: RoundedRectangle(cornerRadius: 17, style: .continuous))
                .foregroundStyle(isUser ? Color.white : Color.primary)
                .textSelection(.enabled)
            }
            if !isUser { Spacer(minLength: 32) }
        }
    }
}

private struct NativeMessageText: View {
    let text: String
    var body: some View {
        if let attributed = try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)) { Text(attributed).font(.body).fixedSize(horizontal: false, vertical: true) }
        else { Text(text).font(.body).fixedSize(horizontal: false, vertical: true) }
    }
}

private struct Composer: View {
    @Binding var text: String
    var focused: FocusState<Bool>.Binding
    let sending: Bool
    let running: Bool
    let send: () -> Void
    let stop: () -> Void
    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Message agent…", text: $text, axis: .vertical).lineLimit(1...6).focused(focused).padding(.horizontal, 13).padding(.vertical, 11).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            Button(action: running ? stop : send) { ZStack { Circle().fill(running ? Color.red : Color.accentColor).frame(width: 44, height: 44); if sending { ProgressView().tint(.white) } else { Image(systemName: running ? "stop.fill" : "arrow.up").font(.headline.bold()).foregroundStyle(.white) } } }.disabled((text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !running) || sending).accessibilityLabel(running ? "Stop agent" : "Send message")
        }.padding(.horizontal, 10).padding(.top, 8).padding(.bottom, 8).background(.bar)
    }
}

private struct ErrorBanner: View { let message: String; var body: some View { Label(message, systemImage: "exclamationmark.triangle.fill").font(.caption).foregroundStyle(.white).frame(maxWidth: .infinity).padding(8).background(.red) } }
