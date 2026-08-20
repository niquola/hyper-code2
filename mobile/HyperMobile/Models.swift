import Foundation

struct AgentSummary: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let model: String
    let runState: String
    let unread: Int
    let turns: Int
    let updatedAt: Double
    let workspaceDir: String
    let pinned: Bool
    let delegated: Bool

    var isRunning: Bool { runState == "running" || runState == "claimed" }
}

struct NewAgentOptions: Codable {
    let version: Int
    let defaultModel: String
    let models: [MobileModel]
    let workspaces: [String]
}
struct MobileModel: Codable, Hashable, Identifiable { let provider: String; let model: String; var id: String { model } }
struct CreatedAgentResponse: Codable { let version: Int; let agent: CreatedAgent }
struct CreatedAgent: Codable { let id: String; let title: String; let model: String; let workspaceDir: String }


struct AgentsResponse: Codable { let version: Int; let agents: [AgentSummary] }

struct MobileEvent: Codable, Identifiable, Hashable {
    let idx: Int
    let ts: Double
    let type: String
    let text: String?
    let name: String?
    let preview: String?
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
    let partial: PartialAssistant?
}
struct PartialAssistant: Codable, Equatable {
    let text: String
    let revision: Int
    let startedAt: Double
}

struct SendResponse: Codable { let version: Int; let ok: Bool; let messageIdx: Int; let eventIdx: Int; let sendAt: Double }
struct CompactResponse: Codable { let version: Int; let ok: Bool; let status: String }
struct DeleteAgentResponse: Codable { let version: Int; let ok: Bool; let agentId: String }

struct StopResponse: Codable { let version: Int; let ok: Bool; let agentId: String }
struct PinResponse: Codable { let version: Int; let agentId: String; let pinned: Bool }
struct ReadResponse: Codable { let version: Int; let ok: Bool; let agentId: String; let seenAt: Double }
struct ToolDetailResponse: Codable { let version: Int; let event: ToolDetail }
struct ToolDetail: Codable, Identifiable {
    let idx: Int
    let ts: Double
    let type: String
    let name: String
    let args: String
    let argsTruncated: Bool
    let result: String
    let resultTruncated: Bool
    let isError: Bool
    var id: Int { idx }
}
struct APIErrorBody: Codable { let error: String?; let message: String? }
