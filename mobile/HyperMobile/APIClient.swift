import Foundation

struct APIClient {
    private struct SendBody: Encodable { let text: String; let debounceMs: Int }
    private struct PinBody: Encodable { let pinned: Bool }
    let baseURL: URL
    private struct LoginBody: Encodable { let password: String }
    private struct LoginResponse: Decodable { let ok: Bool }
    private struct AuthSessionResponse: Decodable { let authenticated: Bool }
    private let session: URLSession
    private struct CreateAgentBody: Encodable { let title: String; let workspaceDir: String; let model: String; let systemPrompt: String; let createWorkspaceDir: Bool }

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func login(password: String) async throws {
        let response: LoginResponse = try await request(path: "auth/login", method: "POST", body: LoginBody(password: password))
        guard response.ok else { throw APIClientError.server("Login failed") }
    }

    func sessionIsAuthenticated() async -> Bool {
        do { let response: AuthSessionResponse = try await request(path: "auth/session"); return response.authenticated }
        catch { return false }
    }


    func newAgentOptions() async throws -> NewAgentOptions {
        try await request(path: "api/mobile/v1/new-agent-options")
    }

    func createAgent(title: String, workspaceDir: String, model: String, systemPrompt: String, createWorkspaceDir: Bool = false) async throws -> CreatedAgent {
        let response: CreatedAgentResponse = try await request(path: "api/mobile/v1/agents", method: "POST", body: CreateAgentBody(title: title, workspaceDir: workspaceDir, model: model, systemPrompt: systemPrompt, createWorkspaceDir: createWorkspaceDir))
        return response.agent
    }


    func agents() async throws -> [AgentSummary] {
        let response: AgentsResponse = try await request(path: "api/mobile/v1/agents")
        return response.agents
    }

    func events(agentID: String, after: Int? = nil, before: Int? = nil, limit: Int = 100) async throws -> EventsResponse {
        var components = URLComponents(url: url("api/mobile/v1/agents/\(escaped(agentID))/events"), resolvingAgainstBaseURL: false)!
        var items = [URLQueryItem(name: "limit", value: String(limit))]
        if let after { items.append(URLQueryItem(name: "after", value: String(after))) }
        if let before { items.append(URLQueryItem(name: "before", value: String(before))) }
        components.queryItems = items
        return try await request(url: components.url!)
    }

    func send(agentID: String, text: String) async throws -> SendResponse {
        try await request(path: "api/mobile/v1/agents/\(escaped(agentID))/messages", method: "POST", body: SendBody(text: text, debounceMs: 100))
    }

    func stop(agentID: String) async throws -> StopResponse {
        try await request(path: "api/mobile/v1/agents/\(escaped(agentID))/stop", method: "POST", body: [String: String]())
    }

    func toolDetail(agentID: String, eventIndex: Int) async throws -> ToolDetail {
        let response: ToolDetailResponse = try await request(path: "api/mobile/v1/agents/\(escaped(agentID))/events/\(eventIndex)")
        return response.event
    }

    func setPinned(agentID: String, pinned: Bool) async throws -> PinResponse {
        try await request(path: "api/mobile/v1/agents/\(escaped(agentID))/pin", method: "POST", body: PinBody(pinned: pinned))
    }

    func markRead(agentID: String) async throws -> ReadResponse {
        try await request(path: "api/mobile/v1/agents/\(escaped(agentID))/read", method: "POST", body: [String: String]())
    }

    private func escaped(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value }
    private func url(_ path: String) -> URL { baseURL.appending(path: path) }

    private func request<T: Decodable, B: Encodable>(path: String, method: String = "GET", body: B? = Optional<String>.none) async throws -> T {
        try await request(url: url(path), method: method, body: body)
    }

    private func request<T: Decodable, B: Encodable>(url: URL, method: String = "GET", body: B? = Optional<String>.none) async throws -> T {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIClientError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let api = try? JSONDecoder().decode(APIErrorBody.self, from: data)
            throw APIClientError.server(api?.message ?? api?.error ?? "HTTP \(http.statusCode)")
        }
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw APIClientError.decoding(error.localizedDescription) }
    }
}

enum APIClientError: LocalizedError {
    case invalidResponse, server(String), decoding(String)
    var errorDescription: String? {
        switch self {
        case .invalidResponse: "Invalid server response"
        case .server(let message): message
        case .decoding(let message): "Could not read Hyper response: \(message)"
        }
    }
}
