import Foundation
import SwiftUI

@MainActor
final class AgentListStore: ObservableObject {
    @Published var agents: [AgentSummary] = []
    @Published var isLoading = false
    @Published var error: String?

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
    private var nextAfter = 0
    private var pollTask: Task<Void, Never>?

    func start(baseURL: URL, agentID: String) async {
        pollTask?.cancel()
        isLoading = true
        do {
            let page = try await APIClient(baseURL: baseURL).events(agentID: agentID, limit: 100)
            events = page.events
            nextAfter = page.nextAfter
            isRunning = page.isRunning
            error = nil
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
            _ = try await APIClient(baseURL: baseURL).send(agentID: agentID, text: value)
            await poll(baseURL: baseURL, agentID: agentID)
            isRunning = true
            error = nil
            return true
        } catch { self.error = error.localizedDescription; return false }
    }

    func stop(baseURL: URL, agentID: String) async {
        do { _ = try await APIClient(baseURL: baseURL).stop(agentID: agentID); isRunning = false; await poll(baseURL: baseURL, agentID: agentID) }
        catch { self.error = error.localizedDescription }
    }

    private func poll(baseURL: URL, agentID: String) async {
        do {
            let page = try await APIClient(baseURL: baseURL).events(agentID: agentID, after: nextAfter, limit: 200)
            if !page.events.isEmpty {
                let existing = Set(events.map(\.idx))
                events.append(contentsOf: page.events.filter { !existing.contains($0.idx) })
            }
            nextAfter = page.nextAfter
            isRunning = page.isRunning
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}
