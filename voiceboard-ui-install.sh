cat <<'EOFVB' > voiceboard-ui-install.sh
#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/hypercycle-development/pure-client-voiceboard-demo.git"
REPO_DIR="pure-client-voiceboard-demo"
SESSION_NAME="voiceboard-ui"

# ---------- helpers ----------
need_cmd() { command -v "$1" >/dev/null 2>&1; }
die() { echo "Error: $*" >&2; exit 1; }

# BSD/GNU portable sed -i
sed_inplace() {
  if sed --version >/dev/null 2>&1; then
    sed -i "$1" "$2"        # GNU sed
  else
    sed -i '' "$1" "$2"     # macOS/BSD sed
  fi
}

replace_key_if_present() {
  local file="$1" key="$2" val="$3"
  if grep -qE "^${key}=" "$file"; then
    sed_inplace "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo ">> Note: '${key}' not found in ${file}; leaving unchanged."
  fi
}

auto_install_tmux() {
  if need_cmd tmux; then
    echo ">> tmux already installed."
    return
  fi
  echo ">> tmux not found."
  if need_cmd apt; then
    echo ">> Installing tmux via apt..."
    sudo apt update && sudo apt install -y tmux
  else
    die "tmux is required. Please install tmux (apt/yum/brew) and re-run."
  fi
}

# Robust check/install for python venv + ensurepip
ensure_python_venv() {
  # 1) If venv + ensurepip already import, we're done.
  if python3 - <<'PY'
import sys
import venv, ensurepip
print(sys.version)
PY
  then
    echo ">> python venv/ensurepip present."
    return
  fi

  # 2) Use apt if available; require sudo.
  if ! need_cmd apt; then
    die "python venv/ensurepip missing and 'apt' not available. Install python3-venv (or pythonX.Y-venv) and re-run."
  fi
  if ! need_cmd sudo; then
    die "sudo not available. Please run with sudo or install python3-venv manually."
  fi

  echo ">> Installing python3-venv via apt..."
  sudo apt update -y
  if ! sudo apt install -y python3-venv; then
    echo ">> 'python3-venv' failed; trying exact version match..."
  fi

  # 3) If still missing, try the exact minor version (e.g., python3.12-venv).
  if ! python3 - <<'PY'
import venv, ensurepip
PY
  then
    PYVER="$(python3 -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
    echo ">> Installing python${PYVER}-venv ..."
    sudo apt install -y "python${PYVER}-venv" || true
  fi

  # 4) Verify ensurepip runs; as last resort, install python3-full.
  if ! python3 -m ensurepip --version >/dev/null 2>&1; then
    echo ">> ensurepip still missing; installing python3-full as a last resort..."
    sudo apt install -y python3-full || true
  fi

  # 5) Final verification.
  python3 - <<'PY'
import venv, ensurepip
PY
  python3 -m ensurepip --version >/dev/null 2>&1 || \
    die "Failed to enable Python venv/ensurepip. Please install python3-venv (or pythonX.Y-venv) manually and re-run."
  echo ">> python venv/ensurepip installed."
}

find_server_dir() {
  # server.py is at repo root in this project, but support a 2-level search
  local d
  d="$(cd "$REPO_DIR" && dirname "$(find . -maxdepth 2 -type f -name 'server.py' -print -quit)")"
  [[ -z "$d" ]] && die "server.py not found in repo."
  echo "$d"
}

ensure_repo_ready() {
  need_cmd git || die "git not found"
  need_cmd python3 || die "python3 not found"
  auto_install_tmux
  ensure_python_venv

  if [[ ! -d "$REPO_DIR/.git" ]]; then
    echo ">> Cloning $REPO_URL ..."
    git clone --depth=1 "$REPO_URL" "$REPO_DIR"
  else
    echo ">> Repo exists. Pulling latest..."
    (cd "$REPO_DIR" && git pull --ff-only)
  fi

  CLONE_PATH="$(cd "$REPO_DIR" && pwd)"
  echo ">> Repository cloned to: $CLONE_PATH"

  SERVER_DIR_REL="$(find_server_dir)"
  cd "$REPO_DIR/$SERVER_DIR_REL"
  WORK_DIR="$(pwd)"

  CONF_FILE="upstream.conf"
  [[ -f "$CONF_FILE" ]] || die "${CONF_FILE} not found. This script only updates an existing file."

  # Clean up a partial venv (from a prior failure) before creating
  if [[ -d ".venv" && ! -x ".venv/bin/python3" ]]; then
    echo ">> Removing incomplete virtual environment (.venv)..."
    rm -rf .venv
  fi

  # Python venv + deps
  if [[ ! -d ".venv" ]]; then
    echo ">> Creating Python virtual environment (.venv)..."
    python3 -m venv .venv
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  if ! python3 -c "import flask, requests" >/dev/null 2>&1; then
    echo ">> Installing required Python packages (Flask, requests) into .venv..."
    python3 -m pip install --upgrade pip
    python3 -m pip install Flask requests
  fi
}

do_prompts_and_update_conf() {
  echo
  echo "=== Voiceboard UI configuration ==="
  read -rp "Web UI local port [8888]: " UI_PORT
  UI_PORT="${UI_PORT:-8888}"

  read -rp "Upstream AIM IP/host (machine running the AIM) [127.0.0.1]: " UP_HOST
  UP_HOST="${UP_HOST:-127.0.0.1}"

  read -rp "Upstream AIM port [8000]: " UP_PORT
  UP_PORT="${UP_PORT:-8000}"

  [[ "$UI_PORT" =~ ^[0-9]{2,5}$ ]] || die "UI port must be numeric (e.g., 8888)"
  [[ "$UP_PORT" =~ ^[0-9]{2,5}$ ]] || die "Upstream port must be numeric (e.g., 8000)"
  [[ -n "$UP_HOST" ]] || die "Upstream host cannot be empty"

  echo ">> Updating ${CONF_FILE} ..."
  replace_key_if_present "$CONF_FILE" "SERVER_PORT"   "$UI_PORT"
  replace_key_if_present "$CONF_FILE" "UPSTREAM_HOST" "$UP_HOST"
  replace_key_if_present "$CONF_FILE" "UPSTREAM_PORT" "$UP_PORT"

  echo
  echo ">> Current upstream.conf values:"
  grep -E '^(SERVER_PORT|UPSTREAM_HOST|UPSTREAM_PORT)=' "$CONF_FILE" || true
  echo
}

tmux_running() {
  tmux has-session -t "$SESSION_NAME" 2>/dev/null
}

start_tmux() {
  tmux new-session -d -s "$SESSION_NAME" "bash -lc 'cd \"$WORK_DIR\" && source .venv/bin/activate && python3 server.py'"
}

stop_tmux() {
  tmux kill-session -t "$SESSION_NAME"
}

print_summary_running() {
  local UI_PORT UP_HOST UP_PORT
  UI_PORT="$(grep -E '^SERVER_PORT=' "$CONF_FILE"    | cut -d= -f2 || echo "8888")"
  UP_HOST="$(grep -E '^UPSTREAM_HOST=' "$CONF_FILE"  | cut -d= -f2 || echo "127.0.0.1")"
  UP_PORT="$(grep -E '^UPSTREAM_PORT=' "$CONF_FILE"  | cut -d= -f2 || echo "8000")"

  echo "------------------------------------------------------------"
  echo "✅ Voiceboard UI is running."
  echo " Repository cloned to : $CLONE_PATH"
  echo " Server running from  : $WORK_DIR"
  echo " Web UI at            : http://localhost:${UI_PORT}"
  echo " Upstream AIM target  : ${UP_HOST}:${UP_PORT}"
  echo " Process manager      : tmux (session: $SESSION_NAME)"
  echo
  echo "ℹ️  It will keep running even if you log out."
  echo "   • Attach to view logs:  tmux attach -t $SESSION_NAME"
  echo "   • Detach (keep running): Ctrl-b then d"
  echo "   • Stop the server:       $(basename "$0") stop"
  echo "   • Restart the server:    $(basename "$0") restart"
  echo "------------------------------------------------------------"
  echo
}

print_summary_started() {
  echo "------------------------------------------------------------"
  echo "✅ Voiceboard UI start complete!"
  echo " Repository cloned to : $CLONE_PATH"
  echo " Server launching from : $WORK_DIR"
  echo " Process manager       : tmux (session: $SESSION_NAME)"
  echo
  echo "ℹ️  It will keep running even if you log out."
  echo "   • Web UI:               see port in upstream.conf (SERVER_PORT)"
  echo "   • Attach to logs:       tmux attach -t $SESSION_NAME"
  echo "   • Detach:               Ctrl-b then d"
  echo "   • Stop the server:      $(basename "$0") stop"
  echo "------------------------------------------------------------"
  echo
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [start|stop|restart|status|attach]

  start    Install/update, prompt for config, and start if not running (default)
  stop     Stop the running tmux session
  restart  Stop (if running) then start (prompts for config again)
  status   Report whether the tmux session is running
  attach   Attach to the tmux session (view logs)

Examples:
  ./$(basename "$0")          # start (install + run if not already)
  ./$(basename "$0") status
  ./$(basename "$0") restart
EOF
}

# ---------- main ----------
CMD="${1:-start}"

case "$CMD" in
  start)
    ensure_repo_ready
    if tmux_running; then
      echo ">> Detected existing tmux session ($SESSION_NAME). Not restarting."
      print_summary_running
      exit 0
    fi
    do_prompts_and_update_conf
    start_tmux
    print_summary_started
    ;;
  stop)
    if tmux_running; then
      stop_tmux
      echo ">> Stopped tmux session: $SESSION_NAME"
    else
      echo ">> Not running (no tmux session named $SESSION_NAME)."
    fi
    ;;
  restart)
    ensure_repo_ready
    if tmux_running; then
      echo ">> Stopping existing tmux session ($SESSION_NAME)..."
      stop_tmux
      sleep 0.5
    fi
    do_prompts_and_update_conf
    start_tmux
    print_summary_started
    ;;
  status)
    ensure_repo_ready
    if tmux_running; then
      echo ">> Status: RUNNING (tmux session: $SESSION_NAME)"
      print_summary_running
    else
      echo ">> Status: STOPPED"
    fi
    ;;
  attach)
    if tmux_running; then
      exec tmux attach -t "$SESSION_NAME"
    else
      echo ">> No running session ($SESSION_NAME). Use: $0 start"
    fi
    ;;
  *)
    usage
    exit 1
    ;;
esac
EOFVB
