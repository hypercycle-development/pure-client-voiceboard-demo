const HyPC = {eth: (NODE, appName) => {
  if (appName === undefined) {
    appName = "USDC Serverless App";
  }

  const insertDecimal = (integer, decimal) => {
    if (0 == (integer % (10 * decimal))) {
      return (integer / (10 * decimal)).toString();
    }
    const str = integer.toString();
    const idx = str.length - decimal;
    return str.slice(0, idx) + "." + str.slice(idx);
  };

  const erc20ABI = [
    {
      "constant": true,
      "inputs": [],
      "name": "name",
      "outputs": [
        {
          "name": "",
          "type": "string"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "_spender",
          "type": "address"
        },
        {
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "totalSupply",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "_from",
          "type": "address"
        },
        {
          "name": "_to",
          "type": "address"
        },
        {
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "transferFrom",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "name": "",
          "type": "uint8"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "_owner",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "name": "balance",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "symbol",
      "outputs": [
        {
          "name": "",
          "type": "string"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "_to",
          "type": "address"
        },
        {
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "_owner",
          "type": "address"
        },
        {
          "name": "_spender",
          "type": "address"
        }
      ],
      "name": "allowance",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "payable": true,
      "stateMutability": "payable",
      "type": "fallback"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "owner",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "spender",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Approval",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event"
    }
  ];

  const CONTRACT_ADDRESSES = {
    //Sepolia
    testnet: {
      pool: "0x7cB852bcD4667b72d49Ff7bBABfB50c35b98626F",
      licenses: "0x096A5d84647d04455ebE68F0aC66312374859Ee9",
      swap: "0x46fA51a4e617C72AaBCDf669014b6a487acbE861",
      chypc: "0x3C56ee0AE9F17F8b32af87B4E3C4Bca4843501B7",
      hypc: "0x640b1274387bf529D016d74161D09c13951867E8",
      poolV2: "0x371a9018F3C63Bc3A89B9f623a65c74E8f40E094",
      swapV2: "0x5c3077CC8108b7C4C59A50829c4Aeba9a523e533",
      fundPoolV1: "0xdbF42E4CD2683D796930e7eb0AEA9d7b40aA13D6",
      shareTokens: "0xD0bD9E3a8835197b6804641cbafb9E379a622646",
      usdc: "0x640b1274387bf529D016d74161D09c13951867E8",
    },
    mainnet: {
      licenses: "0xd32cb5f76989a27782e44c5297aaba728ad61669",
      swap: "0x4F95846E806f19Ba137b6F85f823Db44F0483F0C",
      chypc: "0x0b84DCf0d13678C68Ba9CA976c02eAaA0A44932b",
      hypc: "0xeA7B7DC089c9a4A916B5a7a37617f59fD54e37E4",
      pool: "0xD84135183A735bD886d509E7B05214f1b56ACDB4",
      swapV2: "0x21468e63abF3783020750F7b2e57d4B34aFAfba6",
      shareTokens: "0x4BFbA79CF232361a53eDdd17C67C6c77A6F00379",
      fundPoolV1: "",
      usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
  };

// ethers
const provider = new ethers.BrowserProvider(window.ethereum);

  //web3
  const web3 = new Web3(window.ethereum);
  const Contract = new web3.eth.Contract(erc20ABI, CONTRACT_ADDRESSES.mainnet.usdc);

  const nodeFetch = (endpoint, options) => fetch(`${NODE}/${endpoint}`, options).then(res => res.json());

  const HyPCDec = 6;
  // Contract.methods.decimals().call().then(dec => )

  let MMSDK = null;
  let NODE_INFO = {};
  let USER_ACCOUNTS = [];
  let AIMS = {};

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

  function toSnakeCase(str) {
    return str
      .replace(/[\W_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  const updateNodeFromTxn = (userAddress, txId, value) => {
    const headers = {
      "tx-sender": userAddress,
      "tx-origin": userAddress,
      "hypc-program": "",
      "currency-type": "USDC",
      "tx-driver": "ethereum",
      "tx-id": txId
    };
    return nodeFetch("balance", {method: "POST", headers: headers});
  };

  const sendHyPC = async (value) => {
    console.log("Sending");
    const nodeAddress = NODE_INFO.tm.address;
    const userAddress = USER_ACCOUNTS[0];
    const signer = await provider.getSigner();
    const ethersContract = new ethers.Contract(CONTRACT_ADDRESSES.mainnet.usdc, erc20ABI, signer);

    try {
      // Send USDC
      const tx = await ethersContract.transfer(nodeAddress, value * (10 ** HyPCDec));
      console.log('Transaction hash:', tx.hash);
      
      const dat = await updateNodeFromTxn(userAddress, tx.hash, value);
      const bal = dat.balance[userAddress];

      await provider.waitForTransaction(tx.hash);
      return { balance: bal, status: "ok" };
      
    } catch (error) {
      console.error("Transaction failed:", error);
      return { status: "error", error: error.message };
    }
  };

  const personalSign = (message, address) => {
    const msg = `0x${ASCIItoHex(message)}`;
    return window.ethereum.request({method: "personal_sign", params: [msg, address]})
      .then(data => {
        return {message: message, signature: data};
      });
  };

  const fetchSignedNonce = (userAddress) => fetch(`${NODE}/nonce`, {method: "GET", headers: {sender: userAddress}})
        .then(res => {
          return res.json();
        })
        .then(data => personalSign(data.nonce, userAddress));

  const aimFetch = (aimSlot, endpoint, userAddress, options) => {
    if (options === undefined) {
      options = {};
    }
    const headers = {
      "tx-sender": userAddress,
      "tx-origin": userAddress,
      "hypc-program": "",
      "currency-type": "USDC",
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

    const url = `${NODE}/aim/${aimSlot}/${endpoint}`;
    const method = options.method || "GET";
    const opts = (method === "GET" || method === "HEAD")
          ?  {method: method, headers: hdrs}
          : {method: method, headers: hdrs, body: options.body};

    const shouldRunNonceless = options.isPublic || options.costOnly || endpoint.endsWith("manifest.json");
    if (shouldRunNonceless) {
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

  const nodeInfo = (userAddress) => {
    const headers = {
      "tx-sender": userAddress,
      "tx-origin": userAddress,
      "hypc-program": "",
      "currency-type": "USDC",
      "tx-driver": "ethereum",
    };
    return nodeFetch("info", {method: "GET", headers: headers})
      .then(data => {
        NODE_INFO = data;
        AIMS = data.aim.aims.reduce((memo, aim) => {
          const name = toSnakeCase(aim.image_name);
          memo[name] = {info: aim,
                        fetchManifest: () => aimFetch(aim.slot, "manifest.json", undefined, {method: "GET"}),
                        fetchEstimate: (endpoint, data, options) => {
                          return aimFetch(
                            aim.slot, endpoint, userAddress,
                            Object.assign({}, {
                              method: "POST",
                              headers: {"Content-Type": "application/json"},
                              body: JSON.stringify(data),
                              costOnly: true
                            }, options));
                        },
                        fetchResult: (endpoint, data, options) => {
                          return aimFetch(
                            aim.slot, endpoint, userAddress,
                            Object.assign({}, {
                              method: "POST",
                              headers: {"Content-Type": "application/json"},
                              body: JSON.stringify(data),
                            }, options));
                        }};
          return memo;
        }, {});
        return data;
      });
  };

  const requestAccounts = () => {
    return MMSDK.getProvider().request({ method: "eth_requestAccounts", params: [] })
      .then(accounts => {
        const checks = accounts.map(acc => web3.utils.toChecksumAddress(acc));
        USER_ACCOUNTS = checks;
        console.log(USER_ACCOUNTS);
        return true;
      });
  };

  const fetchBalance = () => {
    const userAddress = USER_ACCOUNTS[0];
    const headers = {
      "tx-sender": userAddress,
      "tx-origin": userAddress,
      "hypc-program": "",
      "currency-type": "USDC",
      "tx-driver": "ethereum",
    };
    return nodeFetch("balance", {method: "GET", headers: headers})
      .then(data => data.balance[userAddress] || {});
  };

  const init = () => {
    MMSDK = new MetaMaskSDK.MetaMaskSDK({enableDebug: false, dappMetadata: {
      name: appName,
      url: window.location.href,
    }});
    return MMSDK.init()
      .then(requestAccounts)
      .then(_ => nodeInfo(USER_ACCOUNTS[0]));
  };

  return {
    utils: {ASCIItoHex: ASCIItoHex,
            toSnakeCase: toSnakeCase,
            insertDecimal: insertDecimal},
    internals: {
      contract: Contract,
      nodeFetch: nodeFetch,
      aimFetch: (aimSlot, endpoint, options) => aimFetch(aimSlot, endpoint, USER_ACCOUNTS[0], options),
      nodeInfo: () => NODE_INFO,
    },
    aims: () => AIMS,
    sendToNode: sendHyPC,
    fetchBalance: fetchBalance,
    nodeFetch: nodeFetch,
    intAsHyPC: hypc_int => insertDecimal(hypc_int, HyPCDec),
    init: init,
    version: "0.0.8"
  };
}};
