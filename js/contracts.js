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
  },
};
const HyPCAddress = CONTRACT_ADDRESSES.testnet.hypc;
const HyPCtn = "0x640b1274387bf529D016d74161D09c13951867E8";
const web3 = new Web3(window.ethereum);
const HyPCContract = new web3.eth.Contract(erc20ABI, HyPCAddress);
