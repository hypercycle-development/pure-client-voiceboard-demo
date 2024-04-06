const byId = id => document.getElementById(id);
const bySel = selector => document.querySelector(selector);

const NODE = "52.88.200.3:8000";
const nodeFetch = (endpoint, options) => fetch(`http://${NODE}/${endpoint}`, options).then(res => res.json());

const DIRECT_AIM = "52.88.200.3:8042";
const directFetch = (endpoint, options) => fetch(`http://${DIRECT_AIM}/${endpoint}`, options).then(res => res.json());

const debounce = (func, timeout = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

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
}

const textToFilename = (text) => {
  const textPrefix = text.toLowerCase()
	.replace(/[^a-zA-Z ]/g, "")
	.split(/\s+/).slice(0, 5).join("-")
  return `voiceboard--${textPrefix}.wav`
}

const estimateText = (text) => directFetch("speak", {
  method: "POST",
  headers: {"Content-Type": "application/json", "cost_only": "1"},
  body: JSON.stringify({text: text, voice: "freeman"})})
      .then(data => data.costs);

const readText = (text, voice) => directFetch("speak", {
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
}

const sorted = (array) => {
  const sorted = array.slice().sort();
  return sorted;
}

const setup = () => {
  console.log("Getting elements...")
  const voice_list = byId("voices");
  const btn_submit = byId("submit");
  const txt_text = byId("text");
  const audio = byId("audio");
  const audio_src = bySel("#audio source");
  const voice_radios = byId("voice_radio_list");
  const lbl_estimate = byId("speak_estimate");
  const lbl_balance = byId("wallet_balance");
  const save_as_link = byId("save_audio");

  const MMSDK = new MetaMaskSDK.MetaMaskSDK({enableDebug: false, dappMetadata: {
    name: "Example Pure JS Dapp",
    url: window.location.href,
  }});

  const updateEstimate = () => {
    estimateText(txt_text.value)
      .then(data => lbl_estimate.innerHTML = `Estimate: ${data[0].estimated_cost} ${data[0].currency}`)
  }

  const updateBalance = () => {
    const userAddress = USER_ACCOUNTS[0];
    const headers = {
      "tx-sender": userAddress,
      "tx-origin": userAddress,
      "hypc-program": "",
      "currency-type": HyPCAddress,
      "tx-driver": "ethereum",
    };
    // 0xCA67B14d0793D031e996DeCfC259733c7e38c903 -- user wallet
    nodeFetch("balance", {method: "GET", headers: headers})
      .then(data => lbl_balance.innerHTML = `Balance: ${data.balance[userAddress][HyPCtn]} HyPC`);
  }

  const nodeInfo = () => {
    const userAddress = USER_ACCOUNTS[0];
    const headers = {
      "tx-sender": userAddress,
      "tx-origin": userAddress,
      "hypc-program": "",
      "currency-type": HyPCAddress,
      "tx-driver": "ethereum",
    };
    nodeFetch("info", {method: "GET", headers: headers})
      .then(data => {
	window.NODE_INFO = data;
	window.AIM = data.aim.aims.find(aim => aim.image_name == "tortoise-tts")
      })
  };


  // TODO - implement payment to the target node
  console.log("Fetching voices...")
  directFetch("list-voices")
    .then(data => sorted(data.available_voices).forEach(voice => {
      const voice_pic = (voice in voiceToImage)
	    ? `<img class="voice-pic" src="img/${voiceToImage[voice]}" /> ${voice}`
	    : `<img class="voice-pic" src="img/default.jpg" /> ${voice}`;
      const rad_div = document.createElement("div")
      rad_div.classList.add("form-check")
      rad_div.classList.add("col-sm-1")
      rad_div.innerHTML = `
	    <input type="radio" name="voice_radio" id="voice_radio_${voice}" value="${voice}" ${(voice == "freeman") ? "checked" : ""} />
	    <label class="form-check-label" for="voice_radio_${voice}">
	      ${voice_pic}
	    </label>`
      voice_radios.appendChild(rad_div);
    }))

  console.log("Getting initial estimate and balance...");
  updateEstimate();
  MMSDK
    .init()
    .then(data => MMSDK.getProvider().request({ method: "eth_requestAccounts", params: [] }))
    .then(accounts => {
      const checks = accounts.map(acc => web3.utils.toChecksumAddress(acc));
      window.USER_ACCOUNTS = checks;
      return true;
    })
    .then(_ => {
      updateBalance();
      nodeInfo();
    })

  txt_text.addEventListener("keyup", debounce(updateEstimate));

  btn_submit.addEventListener("click", (ev) => {
    ev.preventDefault()
    btn_submit.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>Processing...';
    btn_submit.setAttribute("disabled", "");
    console.log("SUBMIT CLICKED");
    const voice = bySel("input[name=voice_radio]:checked").value;
    console.log(`SPEAKING: "${txt_text.value}" - ${voice}`);
    const text = txt_text.value;
    readText(text, voice)
      .then(snd => {
	console.log("SPOKEN", snd)
	btn_submit.innerHTML = "Speak";
	btn_submit.removeAttribute("disabled");
	const bin = convertDataURIToBinary(snd.src);
	const fl = new File([bin], textToFilename(text));
	save_as_link.href = URL.createObjectURL(fl);
	audio_src.src = snd.src;
	audio.load();
	audio.play();
      });
  })
}

window.addEventListener("DOMContentLoaded", () => {
  console.log("HELLO FROM THE LOADED EVENT!")
  console.log("Got health response, setting up...")
  setup()
})
