const byId = id => document.getElementById(id);
const bySel = selector => document.querySelector(selector);

const NODE = "voiceboard.hypercycle.io:8000";
const nodeFetch = (endpoint, options) => fetch(`http://${NODE}/${endpoint}`, options).then(res => res.json());

const MMSDK = new MetaMaskSDK.MetaMaskSDK({enableDebug: false, dappMetadata: {
  name: "Example Pure JS Dapp",
  url: window.location.href,
}});

const updateNodeFromTxn = (userAddress, txId, value) => {
  const headers = {
    "tx-sender": userAddress,
    "tx-origin": userAddress,
    "hypc-program": "",
    "currency-type": "HyPC",
    "tx-driver": "ethereum",
    "tx-value": value,
    "tx-id": txId
  };
  return nodeFetch("balance", {method: "POST", headers: headers});
};

const sendHyPCToNode = (value) => {
  const nodeAddress = window.NODE_INFO.tm.address;
  const userAddress = window.USER_ACCOUNTS[0];
  HyPCContract.methods.transfer(nodeAddress, value).send({"from": userAddress})
    .then(tx => updateNodeFromTxn(userAddress, tx.id, value));
};

const nodeInfo = () => {
  const userAddress = window.USER_ACCOUNTS[0];
  const headers = {
    "tx-sender": userAddress,
    "tx-origin": userAddress,
    "hypc-program": "",
    "currency-type": HyPCAddress,
    "tx-driver": "ethereum",
  };
  return nodeFetch("info", {method: "GET", headers: headers})
    .then(data => {
      window.NODE_INFO = data;
      window.AIM = data.aim.aims.find(aim => aim.image_name == "tortoise-tts");
      return data;
    });
};

const ASCIItoHex = (ascii) => {
  let hex = '';
  let tASCII, Hex;
  ascii.split('').map( i => {
    tASCII = i.charCodeAt(0);
    Hex = tASCII.toString(16);
    hex = hex + Hex + '';
  });
  hex = hex.trim();
  return hex;
};

const personalSign = (message, address) => {
  const msg = `0x${ASCIItoHex(message)}`;
  return window.ethereum.request({method: "personal_sign", params: [msg, address]})
    .then(data => {
      console.log("GOT SIGNED MESSAGE:", message, "SIG:", data);
      return {message: message, signature: data};
    });
};

const fetchSignedNonce = (userAddress) => fetch(`http:${NODE}/nonce`, {method: "GET", headers: {sender: userAddress}})
      .then(res => {
        console.log("GOT NONCE", res);
        return res.json();
      })
      .then(data => personalSign(data.nonce, userAddress));

const aimFetch = (endpoint, userAddress, options) => {
  if (options === undefined) {
    options = {};
  }
  const headers = {
    "tx-sender": userAddress,
    "tx-origin": userAddress,
    "hypc-program": "",
    "currency-type": HyPCAddress,
    "tx-driver": "ethereum"
  };
  if (options.txValue) {
    headers["tx-value"] = options.txValue;
    headers["tx-id"] = options.txId;
  }
  if (options.costOnly) {
    headers.cost_only = "1";
  }
  if (options.isPublic) {
    headers.isPublic = "1";
  }
  const hdrs = Object.assign({}, options.headers, headers);

  const url = `http://${NODE}/aim/0/${endpoint}`;
  const method = options.method || "GET";
  const opts = (method === "GET" || method === "HEAD")
        ?  {method: method, headers: hdrs}
        : {method: method, headers: hdrs, body: options.body};

  console.log("ENDPOINT: ~", endpoint, "~");
  if (options.isPublic || options.costOnly || endpoint.endsWith("/manifest.json")) {
    return fetch(url, opts).then(res => res.json());
  }
  return fetchSignedNonce(userAddress)
    .then(data => {
      hdrs["tx-nonce"] = data.message;
      hdrs["tx-signature"] = data.signature;
      return fetch(url, opts);
    })
    .then(res => res.json());
};

const debounce = (func, timeout = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
};

const convertDataURIToBinary = (dataURI) => {
  const BASE64_MARKER = ';base64,';
  var base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
  var base64 = dataURI.substring(base64Index);
  var raw = window.atob(base64);
  var rawLength = raw.length;
  var array = new Uint8Array(new ArrayBuffer(rawLength));

  for(i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
};

const textToFilename = (text) => {
  const textPrefix = text.toLowerCase()
	.replace(/[^a-zA-Z ]/g, "")
	.split(/\s+/).slice(0, 5).join("-");
  return `voiceboard--${textPrefix}.wav`;
};

const estimateText = (text) => aimFetch("speak", window.USER_ACCOUNTS[0], {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({text: text, voice: "freeman"}),
  costOnly: true});

const readText = (text, voice) => aimFetch("speak", window.USER_ACCOUNTS[0], {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({text: text, voice: voice})})
      .then(data => new Audio("data:audio/wav;base64," + data.file));

const voiceToImage = {
  "applejack": "applejack.png",
  "geralt": "cavill.png",
  "freeman": "freeman.png",
  "deniro": "deniro.png",
  "walken": "walken.png",
  "sagan": "sagan.png",
  "snakes": "jackson.png",
  "halle": "halle.png",
  "jlaw": "jlaw.png",
  "rainbow": "rainbow.png",
  "pat": "patrick.png",
  "pat2": "stewart.png"
};

const sorted = (array) => {
  const res = array.slice().sort();
  return res;
};

const setup = () => {
  console.log("Getting elements...");
  const voice_list = byId("voices");
  const btn_submit = byId("submit");
  const txt_text = byId("text");
  const audio = byId("audio");
  const audio_src = bySel("#audio source");
  const voice_radios = byId("voice_radio_list");
  const lbl_estimate = byId("speak_estimate");
  const lbl_balance = byId("wallet_balance");
  const save_as_link = byId("save_audio");

  const updateEstimate = () => {
    return estimateText(txt_text.value)
      .then(data => lbl_estimate.innerHTML = `Estimate: ${data.HyPC.estimated_cost} HyPC`);
  };

  const updateBalance = () => {
    const userAddress = window.USER_ACCOUNTS[0];
    const headers = {
      "tx-sender": userAddress,
      "tx-origin": userAddress,
      "hypc-program": "",
      "currency-type": HyPCAddress,
      "tx-driver": "ethereum",
    };
    return nodeFetch("balance", {method: "GET", headers: headers}).then(data => {
      const balance = `Balance: ${((data.balance[userAddress] || {})['HyPC']) || 0} HyPC`;
      lbl_balance.innerHTML = balance;
      return balance;
    });
  };

  console.log("Getting initial estimate and balance...");
  MMSDK
    .init()
    .then(data => MMSDK.getProvider().request({ method: "eth_requestAccounts", params: [] }))
    .then(accounts => {
      const checks = accounts.map(acc => web3.utils.toChecksumAddress(acc));
      window.USER_ACCOUNTS = checks;
      return true;
    })
    .then(_ => nodeInfo())
    .then(_ => updateEstimate())
    .then(_ => updateBalance())
    .then(_ => {
      console.log("Fetching voices...");
      return aimFetch("list-voices", window.USER_ACCOUNTS[0]);
    })
    .then(data => sorted(data.available_voices).forEach(voice => {
      console.log("Fetched voices:", data);
      const voice_pic = (voice in voiceToImage)
	    ? `<img class="voice-pic" src="img/${voiceToImage[voice]}" /> ${voice}`
	    : `<img class="voice-pic" src="img/default.jpg" /> ${voice}`;
      const rad_div = document.createElement("div");
      rad_div.classList.add("form-check");
      rad_div.classList.add("col-sm-1");
      rad_div.innerHTML = `
	    <input type="radio" name="voice_radio" id="voice_radio_${voice}" value="${voice}" ${(voice == "freeman") ? "checked" : ""} />
	    <label class="form-check-label" for="voice_radio_${voice}">
	      ${voice_pic}
	    </label>`;
      voice_radios.appendChild(rad_div);
    }));

  txt_text.addEventListener("keyup", debounce(updateEstimate));

  btn_submit.addEventListener("click", (ev) => {
    ev.preventDefault();
    btn_submit.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>Processing...';
    btn_submit.setAttribute("disabled", "");
    console.log("SUBMIT CLICKED");
    const voice = bySel("input[name=voice_radio]:checked").value;
    console.log(`SPEAKING: "${txt_text.value}" - ${voice}`);
    const text = txt_text.value;

    readText(text, voice)
      .then(snd => {
	console.log("SPOKEN", snd);
	btn_submit.innerHTML = "Speak";
	btn_submit.removeAttribute("disabled");
	const bin = convertDataURIToBinary(snd.src);
	const fl = new File([bin], textToFilename(text));
	save_as_link.href = URL.createObjectURL(fl);
	audio_src.src = snd.src;
	audio.load();
	audio.play();
        return updateBalance();
      })
      .catch(err => {
        console.log("FAILED", err);
        btn_submit.innerHTML = "Speak";
	btn_submit.removeAttribute("disabled");
      });
  });
};

window.addEventListener("DOMContentLoaded", () => {
  console.log("HELLO FROM THE LOADED EVENT!");
  console.log("Got health response, setting up...");
  setup();
});
