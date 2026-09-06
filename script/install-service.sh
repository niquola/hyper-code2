#!/usr/bin/env bash
# Install (or remove) Hyper as a launchd user service.
#
# Why a service at all: until now Hyper ran inside whatever tmux session someone
# happened to create. Closing that session sent SIGTERM and the server went away
# silently — with the agents, the cron schedules and the public tunnel — and
# nothing brought it back. Every restart this week was done by hand.
#
# launchd gives a process an EMPTY environment: no HOME, no PATH from your
# shell. Hyper needs both — `bun` to run at all, `op` to resolve 1Password
# secrets, HOME to find ~/.hyper. Those are written into the plist explicitly;
# this is the part that is easy to get wrong and hard to notice, because the
# service then starts and fails in ways that look like application bugs.
#
#   ./script/install-service.sh              install and start
#   ./script/install-service.sh --uninstall  stop and remove
#   ./script/install-service.sh --status     what launchd thinks right now
set -euo pipefail

LABEL="com.niquola.hyper"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"
BUN="$(command -v bun || true)"
PORT="${PORT:-3010}"

status() {
    echo "плист:    $([ -f "$PLIST" ] && echo "$PLIST" || echo "нет")"
    local line; line="$(launchctl list 2>/dev/null | grep -F "$LABEL" || true)"
    if [ -n "$line" ]; then
        echo "launchd:  $line   (PID / последний код выхода / метка)"
    else
        echo "launchd:  не загружен"
    fi
    local pid; pid="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
    echo "порт $PORT: $([ -n "$pid" ] && echo "слушает PID $pid" || echo "свободен")"
    printf 'HTTP:     '; curl -s -o /dev/null -w '%{http_code}\n' --max-time 3 "http://127.0.0.1:$PORT/" || echo "нет ответа"
}

uninstall() {
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "сервис снят; плист удалён"
}

case "${1:-}" in
    --status) status; exit 0 ;;
    --uninstall) uninstall; exit 0 ;;
esac

[ -n "$BUN" ] || { echo "не найден bun в PATH" >&2; exit 1; }
mkdir -p "$HOME/Library/LaunchAgents" "$ROOT/.runtime"

# A server started by hand on the same port would fight the service for it.
existing="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
if [ -n "$existing" ]; then
    echo "порт $PORT занят процессом $existing — останавливаю перед установкой"
    kill "$existing" 2>/dev/null || true
    sleep 2
    kill -9 "$existing" 2>/dev/null || true
fi
# The tmux session this repo used before the service existed.
tmux kill-session -t hyperd 2>/dev/null || true

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>$LABEL</string>

    <key>ProgramArguments</key>
    <array>
        <string>$BUN</string>
        <string>src/\$main.ts</string>
    </array>

    <key>WorkingDirectory</key><string>$ROOT</string>

    <!-- launchd hands over an empty environment. Everything Hyper needs to find
         has to be named here: bun and op live in Homebrew, the hyper CLI in
         ~/.local/bin, and HOME is what makes ~/.hyper and 1Password work. -->
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key><string>$HOME</string>
        <key>PATH</key><string>$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>PORT</key><string>$PORT</string>
        <key>LANG</key><string>en_US.UTF-8</string>
    </dict>

    <key>RunAtLoad</key><true/>
    <!-- Restart whatever the reason: a crash, a provider that killed the
         process, a machine waking up. ThrottleInterval keeps a boot-time error
         from becoming a busy loop. -->
    <key>KeepAlive</key><true/>
    <key>ThrottleInterval</key><integer>10</integer>
    <key>ProcessType</key><string>Interactive</string>

    <!-- The log no longer depends on how the server was started: no tee, no
         tmux pane to lose. stderr is separate so a stack trace is not buried
         in request lines. -->
    <key>StandardOutPath</key><string>$ROOT/.runtime/server.log</string>
    <key>StandardErrorPath</key><string>$ROOT/.runtime/server.error.log</string>
</dict>
</plist>
PLIST_EOF

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl enable "$DOMAIN/$LABEL"

printf 'жду ответа сервера'
for _ in $(seq 1 30); do
    if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/"; then echo; break; fi
    printf '.'; sleep 2
done
echo
status
