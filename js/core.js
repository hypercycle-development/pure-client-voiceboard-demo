const node_url = CONFIG.NODE_URL || "http://52.88.200.3:8000";
const hypClient = HyPC.eth(node_url, "USDC Serverless Voiceboard");

const byId = id => document.getElementById(id);
const bySel = selector => document.querySelector(selector);

const sorted = (array) => {
  const res = array.slice().sort();
  return res;
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

  for (i = 0; i < rawLength; i++) {
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

  const inp_tx_val = byId("transaction_value");
  const btn_update_balance = byId("update_balance");

  const updateEstimate = async () => {
    try {
      const estimate = await hypClient.aims().tortoise_tts.fetchEstimate("speak", { text: txt_text.value, voice: "freeman" });
      const estimated_cost = estimate.HyPC.estimated_cost;
      const response = await hypClient.nodeFetch("exchange_rates", {method : "GET"});
      //TODO: cache the response either here or in the backend.
      const usdcRate = response.find(rate => rate._id === "USDC-HyPC").rate;
      const estimatedCostInUSDC = estimated_cost / usdcRate;
      lbl_estimate.innerHTML = `Estimate: ${(estimatedCostInUSDC / 1e6).toLocaleString('en-US', {
        minimumFractionDigits: 6,
      })} USD`;
    } catch (error) {
      console.error("Failed to fetch estimate", error);
    }
  };

  const setBalance = (balance) => {
    const balance_str = `Balance: ${(balance / 1e6).toLocaleString('en-US', {
      minimumFractionDigits: 6,
    })} USD`;
    lbl_balance.innerHTML = balance_str;
    return balance;
  };

  const updateBalance = () => {
    return hypClient.fetchBalance().then(data => setBalance(data.USDC || 0));
  };

  btn_update_balance.addEventListener("click", ev => {
    ev.preventDefault();
    return hypClient.sendToNode(parseFloat(inp_tx_val.value)).then(updateBalance);
  });

  console.log("Getting initial estimate and balance...");
  hypClient.init()
    .then(_ => updateEstimate())
    .then(_ => updateBalance())
    .then(_ => hypClient.aims().tortoise_tts.fetchResult("list-voices", undefined, { method: "GET" }))
    .then(data => sorted(data.available_voices).forEach(voice => {
      const voice_pic = (voice in voiceToImage)
        ? `<img class="voice-pic" src="img/${voiceToImage[voice]}" /> ${voice}`
        : `<img class="voice-pic" src="img/default.jpg" /> ${voice}`;
      const rad_div = document.createElement("div");
      rad_div.classList.add("form-check");
      rad_div.classList.add("mx-2");
      rad_div.innerHTML = `
	    <input type="radio" name="voice_radio" id="voice_radio_${voice}" value="${voice}" ${(voice == "freeman") ? "checked" : ""} />
	    <label class="form-check-label transition-transform duration-300 ease-in-out transform hover:scale-110" for="voice_radio_${voice}">
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

    hypClient.aims().tortoise_tts.fetchResult("speak", { text: text, voice: voice })
      .then(data => new Audio("data:audio/wav;base64," + data.file))
      .then(snd => {
        console.log("SPOKEN", snd);
        btn_submit.innerHTML = "Speak";
        btn_submit.removeAttribute("disabled");
        const bin = convertDataURIToBinary(snd.src);
        const fl = new File([bin], textToFilename(text));
        save_as_link.href = URL.createObjectURL(fl);
        audio_src.src = snd.src;
        audio.load();
        // audio.play();
        document.getElementById('playPause').click()
        return updateBalance();
      })
      .catch(err => {
        console.log("FAILED", err);
        btn_submit.innerHTML = "Speak";
        btn_submit.removeAttribute("disabled");
      });
  });
    // Call updateBalance every 15 seconds
    setInterval(updateBalance, 15000);
};

window.addEventListener("DOMContentLoaded", () => {
  console.log("Setting up voiceboard...");
  console.log("new version");
  setup();
});
