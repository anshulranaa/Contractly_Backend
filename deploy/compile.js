const fs = require("fs");
const solc = require("solc");

// Read the Solidity contract file
const contractFileName = "test.sol";
const source = fs.readFileSync(contractFileName, "utf8");

// Prepare input for solc compiler
const input = {
  language: "Solidity",
  sources: {
    [contractFileName]: {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["*"],
      },
    },
  },
};

// Compile the contract
const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Find the contract name
const compiledContracts = output.contracts[contractFileName];
const contractNames = Object.keys(compiledContracts);

if (contractNames.length === 0) {
  console.error("No contracts found in the file.");
  process.exit(1);
}

if (contractNames.length > 1) {
  console.warn(
    "Multiple contracts found. Using the first one:",
    contractNames[0]
  );
}

const contractName = contractNames[0];
const contract = compiledContracts[contractName];

// Get ABI and bytecode
const abi = contract.abi;
const bytecode = contract.evm.bytecode.object;

// Write the ABI and bytecode to files
fs.writeFileSync(
  `./compiledContracts/${contractName}_ABI.json`,
  JSON.stringify(abi, null, 2)
);
fs.writeFileSync(`./compiledContracts/${contractName}_Bytecode.txt`, bytecode);

console.log(
  `Compilation successful. ABI and bytecode saved for contract: ${contractName}`
);
