from flask import Flask, request, Response, send_from_directory
import requests, os, sys, time
from pathlib import Path

# ================================================================
#   Configuration loader (reads upstream.conf)
# ================================================================
def load_upstream_config(path="upstream.conf"):
    """
    Reads simple KEY=VALUE lines from upstream.conf into a dict.
    Provides sensible defaults if keys are missing.
    """
    # Defaults
    conf = {
        # Upstream (Node / AIM)
        "UPSTREAM_SCHEME": "http",
        "UPSTREAM_HOST":   "127.0.0.1",
        "UPSTREAM_PORT":   "8000",

        # Local UI/Proxy server
        "SERVER_HOST":     "0.0.0.0",
        "SERVER_PORT":     "8888",

        # Timeouts (seconds)
        "RELAY_TIMEOUT":   "60",
        "SPEAK_TIMEOUT":   "600",
    }

    cfg = Path(path)
    if not cfg.exists():
        print(f"[WARN] upstream.conf not found; using defaults.", file=sys.stderr)
        return conf

    try:
        for line in cfg.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                conf[k.strip()] = v.strip()
    except Exception as e:
        print(f"[WARN] failed reading {path}: {e}", file=sys.stderr)
    return conf


# Load upstream settings
conf = load_upstream_config()

UPSTREAM_SCHEME = conf["UPSTREAM_SCHEME"]
UPSTREAM_HOST   = conf["UPSTREAM_HOST"]
UPSTREAM_PORT   = int(conf["UPSTREAM_PORT"])

SERVER_HOST     = conf["SERVER_HOST"]
SERVER_PORT     = int(conf["SERVER_PORT"])

RELAY_TIMEOUT   = int(conf.get("RELAY_TIMEOUT", 60))
SPEAK_TIMEOUT   = int(conf.get("SPEAK_TIMEOUT", 600))

# Helper: build full upstream base
def upstream_base():
    return f"{UPSTREAM_SCHEME}://{UPSTREAM_HOST}:{UPSTREAM_PORT}"


# ================================================================
#   Flask app setup
# ================================================================
UI_DIR = os.path.abspath(".")
app = Flask(__name__, static_folder=UI_DIR, static_url_path='')

def log(*args):
    ts = time.strftime("%H:%M:%S")
    print(f"[proxy {ts}]", *args, file=sys.stderr, flush=True)


# ================================================================
#   Static UI serving
# ================================================================
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>', methods=['GET'])
def serve_static(path):
    full = os.path.join(UI_DIR, path)
    if os.path.isfile(full):
        return send_from_directory(UI_DIR, path)
    return send_from_directory(UI_DIR, "index.html")


# ================================================================
#   Robust Proxy relay helper
# ================================================================
def relay(upstream_path):
    url = upstream_base() + upstream_path
    headers = {k: v for k, v in request.headers if k.lower() != 'host'}

    try:
        log(f"{request.method} {request.path} -> {url}")

        # Pick timeout (longer for speak)
        tmo = SPEAK_TIMEOUT if upstream_path.endswith("/speak") else RELAY_TIMEOUT

        # Detect JSON or binary
        content_type = request.headers.get('Content-Type', '')
        if content_type.startswith('application/json'):
            data = request.get_json(silent=True)
            resp_up = requests.request(
                method=request.method,
                url=url,
                headers=headers,
                json=data,
                timeout=tmo,
            )
        else:
            resp_up = requests.request(
                method=request.method,
                url=url,
                headers=headers,
                params=request.args,
                data=request.get_data(),
                timeout=tmo,
            )

        log(f"<- upstream {resp_up.status_code} {url}")
        resp = Response(resp_up.content, status=resp_up.status_code)
        for k, v in resp_up.headers.items():
            if k.lower() not in ('content-length', 'transfer-encoding', 'connection'):
                resp.headers[k] = v

        # Optional: allow browser access
        origin = request.headers.get('Origin', '*')
        resp.headers['Access-Control-Allow-Origin'] = origin
        resp.headers['Vary'] = 'Origin'
        return resp

    except Exception as e:
        log(f"!! proxy error to {url}: {e}")
        return Response(f"Proxy error to {url}: {e}", status=502)


# ================================================================
#   CORS helper for OPTIONS
# ================================================================
def preflight_ok():
    resp = Response(status=204)
    req_hdrs = request.headers.get('Access-Control-Request-Headers', '*')
    origin   = request.headers.get('Origin', '*')
    resp.headers['Access-Control-Allow-Origin'] = origin
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = req_hdrs
    resp.headers['Vary'] = 'Origin'
    return resp


# ================================================================
#   CORS and proxy routes
# ================================================================
@app.route('/info', methods=['OPTIONS', 'GET', 'POST'])
def proxy_info():
    if request.method == 'OPTIONS': return preflight_ok()
    return relay("/info")

@app.route('/balance', methods=['OPTIONS', 'GET', 'POST'])
def proxy_balance():
    if request.method == 'OPTIONS': return preflight_ok()
    return relay("/balance")

@app.route('/exchange_rates', methods=['OPTIONS', 'GET', 'POST'])
def proxy_exchange_rates():
    if request.method == 'OPTIONS': return preflight_ok()
    return relay("/exchange_rates")

@app.route('/nonce', methods=['OPTIONS', 'GET', 'POST'])
def proxy_nonce():
    if request.method == 'OPTIONS': return preflight_ok()
    return relay("/nonce")

@app.route('/aim/<path:subpath>', methods=['OPTIONS', 'GET', 'POST'])
def proxy_aim(subpath):
    if request.method == 'OPTIONS': return preflight_ok()
    return relay(f"/aim/{subpath}")

@app.route('/debug', methods=['POST', 'OPTIONS'])
def debug():
    if request.method == 'OPTIONS':
        return preflight_ok()
    return Response('{"ok":true}', status=200, mimetype='application/json')


# ================================================================
#   Health / config route for the frontend
# ================================================================
@app.route('/__upstream')
def show_upstream():
    return {
        "server": {
            "host": SERVER_HOST,
            "port": SERVER_PORT,
        },
        "upstream": {
            "scheme": UPSTREAM_SCHEME,
            "host": UPSTREAM_HOST,
            "port": UPSTREAM_PORT,
            "base": upstream_base(),
        },
        "timeouts": {
            "relay": RELAY_TIMEOUT,
            "speak": SPEAK_TIMEOUT,
        }
    }


# ================================================================
#   Entry point
# ================================================================
if __name__ == '__main__':
    log(f"UI on :{SERVER_PORT}, upstream -> {upstream_base()}")
    app.run(host=SERVER_HOST, port=SERVER_PORT)
