import SwiftUI

private enum ChatItem: Identifiable {
    case event(MobileEvent)
    case tools([MobileEvent])
    var id: String {
        switch self { case .event(let event): "event-\(event.idx)"; case .tools(let tools): "tools-\(tools.first?.idx ?? -1)" }
    }
}

struct NativeChatView: View {
    let agent: AgentSummary
    let baseURL: URL
    let onRead: () -> Void
    @StateObject private var store = ChatStore()
    @State private var draft = ""
    @State private var selectedTool: MobileEvent?
    @FocusState private var focused: Bool

    @Environment(\.dismiss) private var dismiss
    @State private var swipeTranslation: CGFloat = 0
    private var items: [ChatItem] {
        var result: [ChatItem] = [], tools: [MobileEvent] = []
        func flush() { if !tools.isEmpty { result.append(.tools(tools)); tools.removeAll() } }
        for event in store.events {
            if event.type == "tool_call" || event.type == "tool_result" { tools.append(event) }
            else { flush(); result.append(.event(event)) }
        }
        flush(); return result
    }

    var body: some View {
        ZStack {
            DotGridBackground()
            VStack(spacing: 0) {
            if let error = store.error { ErrorBanner(message: error) }
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        if store.isLoading { ProgressView().padding() }
                        ForEach(items) { item in
                            switch item {
                            case .event(let event): EventBubble(event: event)
                            case .tools(let tools): ToolTray(events: tools) { selectedTool = $0 }
                            }
                        }
                        if let partial = store.partial {
                            LiveAssistantBubble(partial: partial)
                                .id("live-assistant")
                        }
                    }.padding(.horizontal, 12).padding(.vertical, 12)
                    .transaction { $0.animation = nil }
                }
                .defaultScrollAnchor(.bottom)
                .onChange(of: store.events.last?.idx) { _, _ in
                    if let last = items.last {
                        var transaction = Transaction()
                        transaction.disablesAnimations = true
                        withTransaction(transaction) { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
                .onChange(of: store.partial?.revision) { _, revision in
                    guard revision != nil else { return }
                    var transaction = Transaction(); transaction.disablesAnimations = true
                    withTransaction(transaction) { proxy.scrollTo("live-assistant", anchor: .bottom) }
                }
            }
                Composer(text: $draft, focused: $focused, sending: store.isSending, running: store.isRunning, send: send, stop: stop)
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(agent.title).navigationBarTitleDisplayMode(.inline)
        .offset(x: swipeTranslation)
        .simultaneousGesture(
            DragGesture(minimumDistance: 18)
                .onChanged { value in
                    guard value.startLocation.x < 32, value.translation.width > 0, abs(value.translation.height) < 80 else { return }
                    swipeTranslation = min(90, value.translation.width * 0.35)
                }
                .onEnded { value in
                    let shouldOpen = value.startLocation.x < 32 && (value.translation.width > 90 || value.predictedEndTranslation.width > 180)
                    withAnimation(.snappy(duration: 0.2)) { swipeTranslation = 0 }
                    if shouldOpen { dismiss() }
                }
        )
        .toolbar { ToolbarItem(placement: .principal) { VStack(spacing: 1) { Text(agent.title).font(.headline).lineLimit(1); Text(store.isRunning ? "Working…" : agent.model).font(.caption2).foregroundStyle(store.isRunning ? .green : .secondary) } } }
        .task { await store.start(baseURL: baseURL, agentID: agent.id) }
        .onDisappear { store.stopPolling(); onRead() }
        .sheet(item: $selectedTool) { event in ToolDetailSheet(baseURL: baseURL, agentID: agent.id, event: event) }
    }

    private func send() { let value = draft; Task { if await store.send(value, baseURL: baseURL, agentID: agent.id) { draft = "" } } }
    private func stop() { Task { await store.stop(baseURL: baseURL, agentID: agent.id) } }
}

private struct DotGridBackground: View {
    @Environment(\.colorScheme) private var colorScheme
    var body: some View {
        Canvas { context, size in
            let color = colorScheme == .dark ? Color.white.opacity(0.12) : Color.black.opacity(0.085)
            var path = Path()
            var y: CGFloat = 8
            while y < size.height {
                var x: CGFloat = 8
                while x < size.width {
                    path.addEllipse(in: CGRect(x: x - 1, y: y - 1, width: 2, height: 2))
                    x += 16
                }
                y += 16
            }
            context.fill(path, with: .color(color))
        }
        .background(Color(.systemGroupedBackground))
        .ignoresSafeArea()
        .accessibilityHidden(true)
        .allowsHitTesting(false)
    }
}

private struct ToolTray: View {
    let events: [MobileEvent]
    let select: (MobileEvent) -> Void
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(events) { event in
                    Button { select(event) } label: {
                        ZStack {
                            Image(systemName: icon(event.name))
                            if event.isError { Circle().fill(.red).frame(width: 8, height: 8).offset(x: 12, y: -12) }
                        }
                        .font(.system(size: 15, weight: .semibold)).foregroundStyle(event.isError ? .red : .primary)
                        .frame(width: 36, height: 36)
                        .background(event.isError ? Color.red.opacity(0.10) : Color(.secondarySystemGroupedBackground), in: Circle())
                        .overlay(Circle().stroke(event.isError ? Color.red.opacity(0.35) : Color.secondary.opacity(0.18)))
                    }.buttonStyle(.plain).accessibilityLabel(event.name ?? "Tool").accessibilityHint(event.preview ?? "Show tool details")
                }
            }.padding(.horizontal, 1)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
    private func icon(_ name: String?) -> String {
        switch name { case "read": "doc.text"; case "write", "edit": "square.and.pencil"; case "grep", "find": "magnifyingglass"; case "bash": "terminal"; case "eval": "chevron.left.forwardslash.chevron.right"; default: "wrench.and.screwdriver" }
    }
}

private struct ToolDetailSheet: View {
    let baseURL: URL, agentID: String, event: MobileEvent
    @State private var detail: ToolDetail?
    @State private var error: String?
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            Group {
                if let detail {
                    ScrollView { VStack(alignment: .leading, spacing: 18) { section("Arguments", detail.args, detail.argsTruncated); section(detail.isError ? "Error" : "Result", detail.result, detail.resultTruncated) }.padding() }
                } else if let error { ContentUnavailableView("Couldn’t load tool", systemImage: "exclamationmark.triangle", description: Text(error)) }
                else { ProgressView("Loading tool…") }
            }
            .navigationTitle(event.name ?? "Tool").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }.presentationDetents([.medium, .large]).task { do { detail = try await APIClient(baseURL: baseURL).toolDetail(agentID: agentID, eventIndex: event.idx) } catch { self.error = error.localizedDescription } }
    }
    private func section(_ title: String, _ text: String, _ truncated: Bool) -> some View {
        VStack(alignment: .leading, spacing: 7) { HStack { Text(title).font(.headline); if truncated { Text("truncated").font(.caption2).foregroundStyle(.orange) } }; ScrollView(.horizontal, showsIndicators: true) { Text(text.isEmpty ? "—" : text).font(.system(.caption, design: .monospaced)).textSelection(.enabled).fixedSize(horizontal: true, vertical: false).padding(12) }.frame(maxWidth: .infinity, alignment: .leading).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12)) }
    }
}

private struct LiveAssistantBubble: View {
    let partial: PartialAssistant
    var body: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 8) {
                NativeMessageText(text: partial.text)
                HStack(spacing: 5) { ProgressView().controlSize(.mini); Text("Responding…").font(.caption2).foregroundStyle(.secondary) }
            }
            .padding(.horizontal, 12).padding(.vertical, 9)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 17, style: .continuous))
            .textSelection(.enabled)
            Spacer(minLength: 32)
        }
    }
}

private struct EventBubble: View {
    let event: MobileEvent
    private var isUser: Bool { event.type == "user" }
    var body: some View { HStack(alignment: .bottom) { if isUser { Spacer(minLength: 54) }; VStack(alignment: .leading, spacing: 6) { if let text = event.text, !text.isEmpty { NativeMessageText(text: text) }; ForEach(Array(event.attachments.enumerated()), id: \.offset) { _, attachment in Label(attachment.name ?? "Attachment", systemImage: "paperclip").font(.caption) } }.padding(.horizontal, 12).padding(.vertical, 9).background(isUser ? Color.accentColor : (event.type == "error" ? Color.red.opacity(0.13) : Color(.secondarySystemGroupedBackground)), in: RoundedRectangle(cornerRadius: 17, style: .continuous)).foregroundStyle(isUser ? Color.white : Color.primary).textSelection(.enabled); if !isUser { Spacer(minLength: 32) } } }
}
private struct NativeMessageText: View { let text: String; var body: some View { if let attributed = try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)) { Text(attributed).font(.callout).fixedSize(horizontal: false, vertical: true) } else { Text(text).font(.callout) } } }
private struct Composer: View {
    @Binding var text: String
    var focused: FocusState<Bool>.Binding
    let sending: Bool, running: Bool
    let send: () -> Void, stop: () -> Void
    private var canSend: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !sending }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Message agent…", text: $text, axis: .vertical)
                .lineLimit(1...6)
                .focused(focused)
                .padding(.horizontal, 13)
                .padding(.vertical, 11)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))

            if running {
                Button(action: stop) {
                    Circle().fill(.red).frame(width: 44, height: 44)
                        .overlay(Image(systemName: "stop.fill").font(.headline.bold()).foregroundStyle(.white))
                }
                .accessibilityLabel("Stop agent")
            }

            Button(action: send) {
                Circle().fill(canSend ? Color.accentColor : Color.secondary.opacity(0.35)).frame(width: 44, height: 44)
                    .overlay {
                        if sending { ProgressView().tint(.white) }
                        else { Image(systemName: "arrow.up").font(.headline.bold()).foregroundStyle(.white) }
                    }
            }
            .disabled(!canSend)
            .accessibilityLabel(running ? "Send steering message" : "Send message")
        }
        .padding(.horizontal, 10).padding(.vertical, 8).background(.bar)
    }
}
private struct ErrorBanner: View { let message: String; var body: some View { Label(message, systemImage: "exclamationmark.triangle.fill").font(.caption).foregroundStyle(.white).frame(maxWidth: .infinity).padding(8).background(.red) } }
