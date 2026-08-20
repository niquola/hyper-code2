import Foundation
import SwiftUI

@MainActor
final class AgentListStore: ObservableObject {
    @Published var agents: [AgentSummary] = []
    @Published var isLoading = false
    @Published var error: String?

    func setPinned(_ agent: AgentSummary, pinned: Bool, baseURL: URL) async {
        do { _ = try await APIClient(baseURL: baseURL).setPinned(agentID: agent.id, pinned: pinned); await load(baseURL: baseURL) }
        catch { self.error = error.localizedDescription }
    }


    func load(baseURL: URL) async {
        isLoading = true
        defer { isLoading = false }
        do { agents = try await APIClient(baseURL: baseURL).agents(); error = nil }
        catch { self.error = error.localizedDescription }
    }
}

@MainActor
final class ChatStore: ObservableObject {
    @Published var events: [MobileEvent] = []
    @Published var isLoading = false
    @Published var isSending = false
    @Published var isRunning = false
    @Published var error: String?
    @Published var partial: PartialAssistant?
    private var nextAfter = 0
    private var pollTask: Task<Void, Never>?
    private var pollInFlight = false

    func start(baseURL: URL, agentID: String) async {
        pollTask?.cancel()
        isLoading = true
        do {
            let page = try await APIClient(baseURL: baseURL).events(agentID: agentID, limit: 100)
            _ = try? await APIClient(baseURL: baseURL).markRead(agentID: agentID)
            events = page.events
            nextAfter = page.nextAfter
            isRunning = page.isRunning
            error = nil
            partial = page.partial
        } catch { self.error = error.localizedDescription }
        isLoading = false
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(self?.isRunning == true ? 1 : 3))
                guard let self, !Task.isCancelled else { break }
                await self.poll(baseURL: baseURL, agentID: agentID)
            }
        }
    }

    func stopPolling() { pollTask?.cancel(); pollTask = nil }

    func send(_ text: String, baseURL: URL, agentID: String) async -> Bool {
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, !isSending else { return false }
        isSending = true
        defer { isSending = false }
        do {
            let response = try await APIClient(baseURL: baseURL).send(agentID: agentID, text: value)
            let optimistic = MobileEvent(idx: response.eventIdx, ts: Date().timeIntervalSince1970 * 1000, type: "user", text: value, name: nil, preview: value, isError: false, attachments: [])
            merge([optimistic])
            nextAfter = max(nextAfter, response.eventIdx + 1)
            isRunning = true
            partial = nil
            error = nil
            return true
        } catch { self.error = error.localizedDescription; return false }
    }

    func stop(baseURL: URL, agentID: String) async {
        do { _ = try await APIClient(baseURL: baseURL).stop(agentID: agentID); isRunning = false; await poll(baseURL: baseURL, agentID: agentID) }
        catch { self.error = error.localizedDescription }
    }

    private func poll(baseURL: URL, agentID: String) async {
        guard !pollInFlight else { return }
        pollInFlight = true
        defer { pollInFlight = false }
        do {
            let page = try await APIClient(baseURL: baseURL).events(agentID: agentID, after: nextAfter, limit: 200)
            merge(page.events)
            nextAfter = max(nextAfter, page.nextAfter)
            isRunning = page.isRunning
            error = nil
            partial = page.partial
        } catch { self.error = error.localizedDescription }
    }

    private func merge(_ incoming: [MobileEvent]) {
        guard !incoming.isEmpty else { return }
        var byIndex = Dictionary(uniqueKeysWithValues: events.map { ($0.idx, $0) })
        for event in incoming { byIndex[event.idx] = event }
        events = byIndex.values.sorted { $0.idx < $1.idx }
    }
}
