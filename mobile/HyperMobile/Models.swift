import Foundation

struct AgentSummary: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let model: String
    let runState: String
    let unread: Int
    let turns: Int
    let updatedAt: Double
    let delegated: Bool

    var isRunning: Bool { runState == "running" || runState == "claimed" }
}

struct AgentsResponse: Codable { let version: Int; let agents: [AgentSummary] }

struct MobileEvent: Codable, Identifiable, Hashable {
    let idx: Int
    let ts: Double
    let type: String
    let text: String?
    let name: String?
    let isError: Bool
    let attachments: [EventAttachment]
    var id: Int { idx }
}

struct EventAttachment: Codable, Hashable {
    let id: String?
    let name: String?
    let contentType: String?
    let size: Int?
}

struct EventsResponse: Codable {
    let version: Int
    let agentId: String
    let events: [MobileEvent]
    let nextAfter: Int
    let hasOlder: Bool
    let isRunning: Bool
    let runState: String
    let lastError: String?
}

struct SendResponse: Codable { let version: Int; let ok: Bool; let messageIdx: Int; let eventIdx: Int; let sendAt: Double }
struct StopResponse: Codable { let version: Int; let ok: Bool; let agentId: String }
struct APIErrorBody: Codable { let error: String?; let message: String? }
