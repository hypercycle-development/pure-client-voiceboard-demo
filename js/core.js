const HyPC = HyPCeth("https://voiceboard.hypercycle.io", "HyPC Serverless Voiceboard");

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

  const updateEstimate = () => {
    return HyPC.aims().tortoise_tts.fetchEstimate("speak", {text: txt_text.value, voice: "freeman"})
      .then(estimate => lbl_estimate.innerHTML = `Estimate: ${estimate.HyPC.estimated_cost} HyPC`);
  };

  const setBalance = (balance) => {
    const balance_str = `Balance: ${balance} HyPC`;
    lbl_balance.innerHTML = balance_str;
    return balance;
  };

  const updateBalance = () => {
    return HyPC.aims().tortoise_tts.fetchResult("speak", {text: txt_text.value, voice: "freeman"})
      .then(data => setBalance(((data.balance || {}).HyPC) || 0));
  };

  btn_update_balance.addEventListener("click", ev => {
    ev.preventDefault();
    return HyPC.sendToNode(parseInt(inp_tx_val.value))
      .then(res => { console.log("BALANCE UPDATED", res); return res; } )
      .then(res => {
        console.log("Request returned...");
        updateBalance();
      });
  });

  console.log("Getting initial estimate and balance...");
  HyPC.init()
    .then(_ => updateEstimate())
    .then(_ => updateBalance())
    .then(_ => HyPC.aims().tortoise_tts.fetchResult("list-voices", undefined, {method: "GET"}))
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

    HyPC.aims().tortoise_tts.fetchResult("speak", {text: text, voice: voice})
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
