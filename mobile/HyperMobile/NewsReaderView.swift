import SwiftUI
import MarkdownUI

private struct NewsBottomOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = .greatestFiniteMagnitude
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

struct NewsReaderView: View {
    let baseURL: URL
    @Environment(\.dismiss) private var dismiss
    @State private var items: [NewsItem] = []
    @State private var index = 0
    @State private var loading = true
    @State private var error: String?
    @State private var pull: CGFloat = 0
    @State private var horizontalDrag: CGFloat = 0
    @State private var atBottom = false
    private var item: NewsItem? { items.indices.contains(index) ? items[index] : nil }

    var body: some View {
        ZStack {
            Color(.systemBackground).ignoresSafeArea()
            if loading { ProgressView("Loading news…") }
            else if let error { ContentUnavailableView("Couldn’t load news", systemImage: "newspaper", description: Text(error)).padding() }
            else if let item {
                article(item)
                    .id(item.id)
                    .offset(x: horizontalDrag, y: pull)
                    .simultaneousGesture(
                        DragGesture(minimumDistance: 20)
                            .onChanged { value in
                                guard abs(value.translation.width) > abs(value.translation.height) * 1.25 else { return }
                                horizontalDrag = value.translation.width * 0.72
                            }
                            .onEnded { value in
                                guard abs(value.translation.width) > abs(value.translation.height) else { return }
                                if value.translation.width < -55 || value.predictedEndTranslation.width < -110 { turnHorizontal(next: true) }
                                else if value.translation.width > 55 || value.predictedEndTranslation.width > 110 { turnHorizontal(next: false) }
                                else { withAnimation(.snappy(duration: 0.2)) { horizontalDrag = 0 } }
                            }
                    )
                VStack { Spacer(); controls(item) }
            } else { ContentUnavailableView("No news", systemImage: "newspaper") }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { dismiss() } label: { Image(systemName: "chevron.left").font(.headline).frame(width: 38, height: 38).background(Color(.secondarySystemBackground), in: Circle()) }.accessibilityLabel("Back to chats")
            }
            ToolbarItem(placement: .principal) { VStack(spacing: 1) { Text("News").font(.headline); if !items.isEmpty { Text("\(index + 1) of \(items.count)").font(.caption2).foregroundStyle(.secondary) } } }
        }
        .task { await load() }
    }

    private func article(_ item: NewsItem) -> some View {
        GeometryReader { viewport in
            ScrollView {
                VStack(alignment: .leading, spacing: 13) {
                    Text(item.source.uppercased()).font(.caption2.weight(.bold)).foregroundStyle(.secondary)
                    Text(item.title).font(.title2.bold()).fixedSize(horizontal: false, vertical: true)
                    if let author = item.author, !author.isEmpty { Text(author).font(.subheadline).foregroundStyle(.secondary) }
                    Markdown(item.summary).markdownTheme(.hyperChat).textSelection(.enabled)
                    if let raw = item.url, let url = URL(string: raw) { Link(destination: url) { Label("Open original", systemImage: "arrow.up.right.square").font(.callout.weight(.semibold)) } }
                    VStack(spacing: 5) {
                        Image(systemName: "chevron.up").font(.caption.weight(.bold))
                        Text(index + 1 < items.count ? "Pull up for next" : "You’re all caught up").font(.caption2)
                    }
                    .frame(maxWidth: .infinity, minHeight: 72)
                    .contentShape(Rectangle())
                    .foregroundStyle(.secondary)
                    .highPriorityGesture(
                        DragGesture(minimumDistance: 10)
                            .onChanged { value in
                                guard value.translation.height < 0 else { return }
                                pull = max(-100, value.translation.height * 0.55)
                            }
                            .onEnded { value in
                                if value.translation.height < -18 || value.predictedEndTranslation.height < -35 { turnNext() }
                                else { withAnimation(.snappy(duration: 0.2)) { pull = 0 } }
                            }
                    )
                    GeometryReader { proxy in
                        Color.clear.preference(key: NewsBottomOffsetKey.self, value: proxy.frame(in: .named("news-scroll")).maxY)
                    }.frame(height: 1)
                    Color.clear.frame(height: 88)
                }.padding(.horizontal, 18).padding(.top, 12)
            }
            .coordinateSpace(name: "news-scroll")
            .onPreferenceChange(NewsBottomOffsetKey.self) { atBottom = $0 <= viewport.size.height + 30 }
        }
    }

    private func controls(_ item: NewsItem) -> some View {
        HStack(spacing: 16) {
            Button { previous() } label: { Image(systemName: "chevron.left").frame(width: 42, height: 42) }.disabled(index == 0)
            Button { toggleLike(item) } label: { Image(systemName: item.liked ? "heart.fill" : "heart").foregroundStyle(item.liked ? .red : .primary).frame(width: 42, height: 42) }
            Button { next() } label: { HStack(spacing: 5) { Text("Next"); Image(systemName: "chevron.up") }.font(.callout.weight(.semibold)).padding(.horizontal, 13).frame(height: 42) }.disabled(index + 1 >= items.count)
        }.padding(.horizontal, 12).hyperGlass(Capsule(), interactive: true).padding(.bottom, 10)
    }

    private func turnHorizontal(next: Bool) {
        let allowed = next ? index + 1 < items.count : index > 0
        guard allowed else { withAnimation(.snappy) { horizontalDrag = 0 }; UINotificationFeedbackGenerator().notificationOccurred(.warning); return }
        if next { markRead(items[index]) }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        withAnimation(.easeOut(duration: 0.14)) { horizontalDrag = next ? -UIScreen.main.bounds.width : UIScreen.main.bounds.width }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) {
            index += next ? 1 : -1
            horizontalDrag = next ? UIScreen.main.bounds.width * 0.32 : -UIScreen.main.bounds.width * 0.32
            atBottom = false
            withAnimation(.snappy(duration: 0.24)) { horizontalDrag = 0 }
        }
    }

    private func turnNext() {
        guard index + 1 < items.count else { withAnimation(.snappy) { pull = 0 }; UINotificationFeedbackGenerator().notificationOccurred(.warning); return }
        markRead(items[index]); UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        withAnimation(.easeOut(duration: 0.14)) { pull = -UIScreen.main.bounds.height * 0.22 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) {
            index += 1; atBottom = false; pull = 70
            withAnimation(.snappy(duration: 0.25)) { pull = 0 }
        }
    }
    private func next() { turnNext() }
    private func previous() { guard index > 0 else { return }; UIImpactFeedbackGenerator(style: .light).impactOccurred(); withAnimation(.snappy) { index -= 1; atBottom = false } }
    private func toggleLike(_ value: NewsItem) { let liked = !value.liked; items[index].liked = liked; Task { _ = try? await APIClient(baseURL: baseURL).setNewsLiked(id: value.id, liked: liked) } }
    private func markRead(_ value: NewsItem) { if !value.read { Task { try? await APIClient(baseURL: baseURL).markNewsRead(id: value.id) } } }
    private func load() async { loading = true; defer { loading = false }; do { items = try await APIClient(baseURL: baseURL).news() } catch { self.error = error.localizedDescription } }
}
