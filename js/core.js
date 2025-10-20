// core.js — merged + hardened
// - Manual wallet connect UX preserved
// - tx-sender header injection for all client calls
// - Debounced estimate calls with guards (no 400-per-keystroke)

// ---- Config + client --------------------------------------------------------
const node_url = (typeof CONFIG !== "undefined" && "NODE_URL" in CONFIG)
  ? CONFIG.NODE_URL
  : ""; // same-origin base

const hypClient = HyPC.eth(node_url, "USDC Serverless Voiceboard");

// ---- Wallet address helpers (no auto eth_requestAccounts here) --------------
function currentAddressLower() {
  try {
    const addr =
      (window.ethereum && window.ethereum.selectedAddress) ||
      (Array.isArray(hypClient?.wallets) && hypClient.wallets[0]) ||
      null;
    return addr ? addr.toLowerCase() : null;
  } catch (_) {
    return null;
  }
}

// ---- Nonce/signature cache + helpers --------------------------------------
const __authCache = {
  address: null,
  nonce: null,
  signature: null,
  ts: 0,
};

function clearAuthCache() {
  __authCache.address = null;
  __authCache.nonce = null;
  __authCache.signature = null;
  __authCache.ts = 0;
}

async function ensureAuthHeaders() {
  const addr = currentAddressLower();
  if (!addr) return null; // no wallet connected

  // reuse if fresh for 2 minutes
  const FRESH_MS = 2 * 60 * 1000;
  if (__authCache.address === addr && (Date.now() - __authCache.ts) < FRESH_MS && __authCache.signature) {
    return { nonce: __authCache.nonce, signature: __authCache.signature };
  }

  // 1) get nonce from node
  let nonceResp;
  try {
    nonceResp = await hypClient.nodeFetch("nonce", { method: "GET" });
  } catch (e) {
    return null; // nonce endpoint unavailable
  }

  // Extract a primitive string nonce
  let nonceVal = nonceResp?.nonce ?? nonceResp?.data ?? nonceResp?.value ?? nonceResp;
  if (typeof nonceVal !== "string") {
    try { nonceVal = JSON.stringify(nonceVal); } catch (_) { nonceVal = String(nonceVal); }
  }
  if (!nonceVal) return null;

  // MetaMask personal_sign expects a hex string payload
  // Use ethers (if present) or manual utf8->hex conversion
  let hexMsg;
  try {
    if (window.ethers?.utils?.hexlify && window.ethers?.utils?.toUtf8Bytes) {
      hexMsg = window.ethers.utils.hexlify(window.ethers.utils.toUtf8Bytes(nonceVal));
    } else if (window.Web3?.utils?.utf8ToHex) {
      hexMsg = window.Web3.utils.utf8ToHex(nonceVal);
    } else {
      // manual conversion
      const enc = new TextEncoder();
      const bytes = enc.encode(nonceVal);
      hexMsg = "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (_) {
    hexMsg = "0x" + Array.from(new TextEncoder().encode(String(nonceVal))).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // 2) sign nonce (prefer personal_sign). Try both param orders to satisfy providers.
  let signature = null;
  if (window.ethereum?.request) {
    try {
      signature = await window.ethereum.request({ method: "personal_sign", params: [hexMsg, addr] });
    } catch (e1) {
      try {
        signature = await window.ethereum.request({ method: "personal_sign", params: [addr, hexMsg] });
      } catch (e2) {
        try {
          signature = await window.ethereum.request({ method: "eth_sign", params: [addr, hexMsg] });
        } catch (e3) {
          signature = null;
        }
      }
    }
  }

  if (!signature) return null;

  __authCache.address = addr;
  __authCache.nonce = nonceVal; // cache the human-readable form; header will carry this value
  __authCache.signature = signature;
  __authCache.ts = Date.now();

  return { nonce: nonceVal, signature };
}

function applyAuthHeaders(opts = {}) {
  const headers = opts.headers || {};
  if (__authCache.signature && __authCache.nonce) {
    headers["tx-nonce"] = __authCache.nonce;
    headers["tx-signature"] = __authCache.signature;
  }
  opts.headers = headers;
  return opts;
}

async function withAuthRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    const status = (err && (err.status || err.code || err?.response?.status)) || 0;
    const msg = (err && (err.message || err?.response?.statusText || "")) + "";
    if (status === 400 || status === 401 || /invalid nonce|nonce/i.test(msg)) {
      clearAuthCache();
      // Try to refresh auth and retry once
      try { await ensureAuthHeaders(); } catch (_) {}
      return fn();
    }
    throw err;
  }
}

// Inject tx-sender on all client calls when available
const _aimFetch  = hypClient.aimFetch?.bind(hypClient);
if (_aimFetch) {
  hypClient.aimFetch = async (path, body, opts = {}) => {
    const addr = currentAddressLower();
    opts.headers = opts.headers || {};
    if (addr && !opts.headers["tx-sender"]) opts.headers["tx-sender"] = addr;

    // If explicitly marked cost-only, add header and SKIP auth entirely
    if (opts.costOnly === true || opts.headers["cost-only"] === true || opts.headers["cost-only"] === "true") {
      opts.headers["cost-only"] = "true"; // normalize
      return _aimFetch(path, body, opts);
    }

    // Only attach auth when a caller asks for it
    if (opts.requireAuth === true) {
      try { await ensureAuthHeaders(); } catch (_) {}
      opts = applyAuthHeaders(opts);
    }

    return _aimFetch(path, body, opts);
  };
}

const _nodeFetch = hypClient.nodeFetch?.bind(hypClient);
if (_nodeFetch) {
  hypClient.nodeFetch = async (path, opts = {}) => {
    const addr = currentAddressLower();
    opts.headers = opts.headers || {};
    if (addr && !opts.headers["tx-sender"]) opts.headers["tx-sender"] = addr;

    // Node calls generally don't need auth unless explicitly requested
    if (opts.requireAuth === true) {
      try { await ensureAuthHeaders(); } catch (_) {}
      opts = applyAuthHeaders(opts);
    }

    return _nodeFetch(path, opts);
  };
}

// ---- DOM utils --------------------------------------------------------------
const byId  = id       => document.getElementById(id);
const bySel = selector => document.querySelector(selector);
const sorted = arr => arr.slice().sort();

const debounce = (fn, timeout = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), timeout);
  };
};

const convertDataURIToBinary = dataURI => {
  const BASE64_MARKER = ";base64,";
  const base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
  const base64 = dataURI.substring(base64Index);
  const raw = window.atob(base64);
  const array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array;
};

const textToFilename = text =>
  `voiceboard--${text.toLowerCase().replace(/[^a-zA-Z ]/g, "")
    .split(/\s+/).slice(0, 5).join("-")}.wav`;

const voiceToImage = {
  applejack: "applejack.png",
  geralt:    "cavill.png",
  freeman:   "freeman.png",
  deniro:    "deniro.png",
  walken:    "walken.png",
  sagan:     "sagan.png",
  snakes:    "jackson.png",
  halle:     "halle.png",
  jlaw:      "jlaw.png",
  rainbow:   "rainbow.png",
  pat:       "patrick.png",
  pat2:      "stewart.png"
};

// ---- Main UI setup ----------------------------------------------------------
function setup() {
  // Prevent duplicate bindings if setup() is called more than once
  if (window.__voiceboardSetupDone__) return;
  window.__voiceboardSetupDone__ = true;

  console.log("Setting up Voiceboard UI…");

  const voice_list     = byId("voices");
  const btn_submit     = byId("submit");
  const txt_text       = byId("text");
  const audio          = byId("audio");
  const audio_src      = bySel("#audio source");
  const voice_radios   = byId("voice_radio_list");
  const lbl_estimate   = byId("speak_estimate");
  const lbl_balance    = byId("wallet_balance");
  const save_as_link   = byId("save_audio");
  const inp_tx_val     = byId("transaction_value");
  const btn_update_bal = byId("update_balance");

  // ------- Estimate logic (debounced + guarded) -----------------------------
  let _lastEstimateText = "";
  let _isComposing = false;

  const setEstimateDash = () => {
    if (lbl_estimate) lbl_estimate.innerHTML = "Estimate: —";
  };

  const updateEstimate = async () => {
    try {
      const text = (txt_text?.value || "").trim();

      if (text.length < 8) { setEstimateDash(); return; }
      if (text === _lastEstimateText) return;
      if (_isComposing) return;

      // IMPORTANT: Estimate should not require auth and must be cost-only
      const estimate = await hypClient.aims().tortoise_tts.fetchResult(
        "speak",
        { text, voice: "freeman" },
        { method: "POST", costOnly: true, headers: { "cost-only": "true" } }
      );

      const estimated_cost = estimate?.HyPC?.estimated_cost ?? estimate?.estimated_cost ?? null;
      if (estimated_cost == null) { setEstimateDash(); return; }

      const response = await hypClient.nodeFetch("exchange_rates", { method: "GET" });
      const usdcRate = Array.isArray(response)
        ? (response.find(r => r._id === "USDC-HyPC")?.rate)
        : (response?.rate || null);
      if (!usdcRate) { setEstimateDash(); return; }

      const estimatedCostInUSDC = estimated_cost / usdcRate;
      if (lbl_estimate) {
        lbl_estimate.innerHTML = `Estimate: ${(estimatedCostInUSDC / 1e6).toLocaleString("en-US", { minimumFractionDigits: 6 })} USD`;
      }
      _lastEstimateText = text;
    } catch (err) {
      setEstimateDash();
    }
  };

  // Prefer input + composition events; debounce to avoid call storms
  if (txt_text) {
    txt_text.addEventListener("compositionstart", () => { _isComposing = true; });
    txt_text.addEventListener("compositionend",   () => { _isComposing = false; updateEstimate(); });
    txt_text.addEventListener("input", debounce(updateEstimate, 600)); // 600–800ms is a good range
  }

  // ------- Balance + deposit ------------------------------------------------
  const setBalance = bal => {
    if (lbl_balance) {
      lbl_balance.innerHTML =
        `Balance: ${(bal / 1e6).toLocaleString("en-US", { minimumFractionDigits: 6 })} USD`;
    }
    return bal;
  };

  const updateBalance = () =>
    hypClient.fetchBalance().then(d => setBalance(d.USDC || 0)).catch(() => setBalance(0));

  if (btn_update_bal && inp_tx_val) {
    btn_update_bal.addEventListener("click", e => {
      e.preventDefault();
      const val = parseFloat(inp_tx_val.value);
      if (!isFinite(val) || val <= 0) return;
      hypClient.sendToNode(val).then(updateBalance).catch(() => {});
    });
  }

  // ------- Init + initial data ---------------------------------------------
  hypClient.init()
    .then(updateEstimate)
    .then(updateBalance)
    .then(() =>
      hypClient.aims().tortoise_tts.fetchResult("list-voices", undefined, { method: "GET" })
    )
    .then(data => {
      const arr = Array.isArray(data?.available_voices) ? data.available_voices : [];
      arr && sorted(arr).forEach(voice => {
        const img = voiceToImage[voice] ? voiceToImage[voice] : "default.jpg";
        const div = document.createElement("div");
        div.classList.add("form-check", "mx-2");
        div.innerHTML = `
          <input type="radio" name="voice_radio" id="voice_radio_${voice}" value="${voice}"
            ${voice === "freeman" ? "checked" : ""}/>
          <label class="form-check-label transition-transform duration-300 ease-in-out transform hover:scale-110"
            for="voice_radio_${voice}">
            <img class="voice-pic" src="img/${img}" /> ${voice}
          </label>`;
        voice_radios && voice_radios.appendChild(div);
      });
    })
    .catch(err => {
      console.error("list-voices failed", err);
    });

  // ------- Speak action -----------------------------------------------------
  if (btn_submit) {
    btn_submit.addEventListener("click", (ev) => {
      ev.preventDefault();
      btn_submit.innerHTML =
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>Processing...';
      btn_submit.setAttribute("disabled", "");

      const selected = bySel("input[name=voice_radio]:checked");
      const voice = selected ? selected.value : "freeman"; // fallback
      const text = (txt_text?.value || "");

      hypClient.aims().tortoise_tts.fetchResult("speak", { text, voice }, { requireAuth: true })
        .then(data => new Audio("data:audio/wav;base64," + data.file))
        .then(snd => {
          btn_submit.innerHTML = "Speak";
          btn_submit.removeAttribute("disabled");
          const bin = convertDataURIToBinary(snd.src);
          const fl = new File([bin], textToFilename(text));
          if (save_as_link) save_as_link.href = URL.createObjectURL(fl);
          if (audio_src && audio) {
            audio_src.src = snd.src;
            audio.load();
            const playBtn = document.getElementById("playPause");
            playBtn && playBtn.click();
          }
          return updateBalance();
        })
        .catch(err => {
          console.error("Speak failed", err);
          btn_submit.innerHTML = "Speak";
          btn_submit.removeAttribute("disabled");
        });
    });
  }

  // refresh balance every 15s
  setInterval(updateBalance, 15000);
}

// Expose for index.html to call after wallet connect
window.setup = setup;
