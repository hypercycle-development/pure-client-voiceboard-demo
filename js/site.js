function LoadThisPage() {
    document.getElementById("connectButton").addEventListener("click", Connect);
}

async function Connect(event) {
    await ConnectMetaMask(event, updatePage);
}

async function updatePage(){
    var elm1 = document.getElementById("mainConnectedDiv");
    var elm2 = document.getElementById("connectButton");

    if (gAccount) {
        await updateAddressAndBalance();
        await populateNodeTable();
        elm1.style.display = "block";
        elm2.style.display = "none";
    } else {
        elm1.style.display = "none";
        elm2.style.display = "block";
    }
}

async function updateAddressAndBalance() {
    let myAddress = await getAccount();
    let myBalanceHyPC = await getBalanceHyPC(myAddress);
    let myBalanceETH = await getBalanceETH(myAddress);
    document.getElementById("myAddress").textContent = myAddress;
    document.getElementById("myBalanceHyPC").textContent = myBalanceHyPC;
    document.getElementById("myBalanceETH").textContent = myBalanceETH;
}

var gSelected;
var gAimData;

async function populateNodeTable() {
    var elm = document.getElementById("nodeTable");
    let url = window.location.protocol+"//"+window.location.hostname
    if (window.location.port)
        url += ":"+window.location.port;
    url += "/nodes";

    let userAddress = gAccount[0];

    let data = await fetch(url)
    data = await data.json()
    elm.style.display = "grid";
    elm.style['grid-template-columns'] = "1fr 1fr 1fr 1fr 1fr";
    elm.style['grid-gap'] = "10px";
    elm.style.width = "500px";
    elm.innerHTML = "<div>Address</div><div>Balance</div><div>Spots Available</div><div>Cost/Month</div><div>Select</div>";

    for (let i=0;i<data.length;i++) {
            //Get the aim slot:
            let aimSlot = 0;
            for (let k=0;k<data[i].aim.aims.length;k++) {
                    if (data[i].aim.aims[k].image_name == "hyperbox-tiller") {
                            aimSlot = k;
                            break;
                    }
            }
            data[i]['aimSlot'] = aimSlot;
            //get the nodes available slots left
            let tillers = await getTillers(data[i]['address'], aimSlot);
            let slotsLeft = tillers['available'];
            //get this nodes cost per month.
            let costPerMonth = await getCostPerMonth(data[i]['address'], aimSlot);
            let nodeBalance = await getNodeBalance(data[i]['address'], userAddress);
            elm.innerHTML += "<div>"+data[i]['address']+"</div><div>"+nodeBalance+"</div><div>"+slotsLeft+"</div><div>"+costPerMonth['HyPC']['estimated_cost']+"</div><div><button id=\"button\""+i+" onClick=\"selectButton("+i+");\">Select</button></div>";
    }
    gAimData = data;
}

async function selectButton(number) {
    let elm1 = document.getElementById("aimTable");
    let elm2 = document.getElementById("selectedNode");
    let elm3 = document.getElementById("runningTillers");
    let elm4 = document.getElementById("actions");

    elm1.style.display = "block";
    /*
        Displaying: node
        Running Tillers:
        Add Balance| amount | Submit
        Create Tiller | message, priority | Submit
    */
    //Selected node
    elm2.innerHTML = "<div>Displaying: "+gAimData[number]['address']+" Slot: "+gAimData[number]['aimSlot']+"</div>";
    elm2.innerHTML += "<div style=\"display:grid;grid-template-columns: 1fr 1fr 1fr\"><div>Add balance to node</div><div><input id=\"balance\" placeholder=\"HyPC\"/></div><div><button onClick=\"addBalanceToNode("+number+");\">Connect</button></div></div>";


    //Running tillers..
    tillers = await getTillers(gAimData[number]['address'], gAimData[number]['aimSlot']);
    /*
                {"tillers": {"number": i+1, "license": license_number,
                          "priority": priority, "address": user_address,
                          "message": message, "run_until": run_until,
                          "time_left": run_until-time.time()
                }
    */
    elm3.style.display = "grid";
    elm3.style['grid-template-columns'] = "1fr 1fr 1fr 1fr 1fr";
    elm3.style.width = "500px";
    elm3.innerHTML = "<div>Number</div><div>License</div><div>Priority</div><div>Message</div><div>Time Left (sec)</div>";
    let flag = false;
    for (let i=0;i<tillers;i++) {
        if (tillers[i]['address'] == userAddress) {
            elm3.innerHTML += "<div>"+tillers[i]['number']+"</div><div>"+tillers[i]['license']+"</div><div>"+tillers[i]['priority']+"</div><div>"+tillers[i]['message']+"</div><div>"+tillers[i]['time_left']+"</div>"
            flag = true;
        }
    }
    if (flag == false) {
        elm3.innerHTML += "<div>No entries</div><div></div><div></div><div></div><div></div>";
    }

    elm4.style.display = "grid";
    elm4.style['grid-template-columns'] = "1fr 1fr 1fr 1fr 1fr 1fr";
    elm4.innerHTML += "<div>Create Call</div><div></div><div></div><div></div><div></div><div><button onClick=\"createCall("+number+");\">Submit</button></div>"

    elm4.innerHTML += "<div>Get Message Call</div><div><input id=\"getmessage_number\" placeholder=\"number\"/></div><div><input id=\"getmessage_license\" placeholder=\"license number\"/></div><div><input id=\"getmessage_chypc\" placeholder=\"chypc number\"/></div><div></div><div><button onClick=\"getMessageCall("+number+");\">Submit</button></div>"

    elm4.innerHTML += "<div>Update Call</div><div><input id=\"update_number\" placeholder=\"number\"/></div><div><input id=\"update_message\" placeholder=\"message\"/></div><div><input id=\"update_signature\" placeholder=\"signature\"/></div><div><input id=\"update_priority\" placeholder=\"priority\"/></div><div><button onClick=\"updateCall("+number+");\">Submit</button></div>"

    elm4.innerHTML += "<div>Topup Call</div><div><input id=\"topup_number\" placeholder=\"number\"/></div><div></div><div></div><div></div><div><button onClick=\"topupCall("+number+");\">Submit</button></div>"

}

async function addBalanceToNode(number) {
    let data = gAimData[number];
    let node = data['address']
    let userAddress = gAccount[0];
    let value = web3.utils.toBN(Math.floor(parseFloat(document.getElementById("balance").value)*1000000));
    await connectToNode(node, userAddress, value);
    await selectButton(number);
}

async function createCall(number) {
    let data = gAimData[number];
    let node = data['address'];
    let aimSlot = data['aimSlot'];
    let userAddress = gAccount[0]

    let body = JSON.stringify({});
    let rdata = await aimFetch(userAddress, node, aimSlot,
        "POST", "/create", {}, body, {});
    rdata = await rdata.json()
    if (rdata['status'] == "started") {
        alert("tilling started");
    } else {
        alert("tilling failed.");
    }
    return rdata;
}

async function getMessageCall(number) {
    let data = gAimData[number];
    let node = data['address'];
    let aimSlot = data['aimSlot'];
    let userAddress = gAccount[0]
    let license_number = document.getElementById("getmessage_license").value;
    let chypc = document.getElementById("getmessage_chypc").value;
    let body = JSON.stringify({"license": license_number, "chypc": chypc, "number": number});

    let rdata = await aimFetch(userAddress, node, aimSlot,
        "GET", "/get_message?license="+license_number+"&chypc="+chypc+"&number="+number, {},"", {"isPublic": true});
    rdata = await rdata.json();
    let message = rdata['message'];
    alert("message is: "+message)
    return message;
}

async function updateCall(number) {
    let data = gAimData[number];
    let node = data['address'];
    let aimSlot = data['aimSlot'];
    let tiller = document.getElementById("update_number").value;
    let message = document.getelementbyid("update_message").value;
    let signature = document.getelementbyid("update_signature").value;
    let priority = document.getElementById("update_priority").value;

    let userAddress = gAccount[0];

    let body = JSON.stringify({"number": parseInt(tiller), "message": message, "priority": parseInt(priority), "signature": signature});
    let rdata = await aimFetch(userAddress, node, aimSlot,
        "POST", "/update", {}, body, {});
    rdata = await rdata.json()
    if (rdata['status'] == "updated") {
        alert("tilling updated");
    } else {
        alert("tilling update failed");
    }
    return rdata;
}

async function topupCall(number) {
    let data = gAimData[number];
    let node = data['address'];
    let aimSlot = data['aimSlot'];
    let tiller = document.getElementById("update_number").value;

    let userAddress = gAccount[0];

    let body = JSON.stringify({"number": parseInt(tiller)});
    let rdata = await aimFetch(userAddress, node, aimSlot,
        "POST", "/topup", {}, body, {});
    rdata = await rdata.json()
    if (rdata['status'] == "updated") {
        alert("tilling topped up");
    } else {
        alert("tilling topup failed");
    }
    return rdata;
}

async function getTillers(node, aimSlot) {
    //use the aim caller interface.
    let userAddress = gAccount[0]
    let data = await aimFetch(userAddress, node, aimSlot,
        "GET", "/list", {}, "", {"isPublic": true});
    data = await data.json()
    return data;
}

async function getCostPerMonth(node, aimSlot) {
    //use the aim caller interface.
    let userAddress = gAccount[0]

    let data = await aimFetch(userAddress, node, aimSlot,
        "POST", "/create", {}, "{\"message\":\"\", \"priority\": 0}", {"costOnly": true});
    data = await data.json()
    let cost = data;
    return cost;
}
