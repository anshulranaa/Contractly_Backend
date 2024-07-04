require("dotenv").config();
const ethers = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  try {
    // Find the ABI file
    const compiledContractsDir = path.join(__dirname, "compiledContracts");
    const files = fs.readdirSync(compiledContractsDir);
    const abiFile = files.find((file) => file.endsWith("_ABI.json"));
    const bytecodeFile = files.find((file) => file.endsWith("_Bytecode.txt"));

    if (!abiFile || !bytecodeFile) {
      throw new Error("ABI or Bytecode file not found");
    }

    // Extract contract name from the file name
    const contractName = abiFile.replace("_ABI.json", "");

    // Read the ABI and bytecode
    const abi = JSON.parse(
      fs.readFileSync(path.join(compiledContractsDir, abiFile), "utf8")
    );
    const bytecode = fs
      .readFileSync(path.join(compiledContractsDir, bytecodeFile), "utf8")
      .trim();

    // Connect to the network
    const provider = new ethers.JsonRpcProvider(process.env.INFURIA_URL);

    // Your wallet private key
    const privateKey = process.env.WALLET_PVT_KEY;

    // For Deploying using Metamask.

    // if (!privateKey) {
    //   throw new Error("Private key not found in environment variables");
    // }
    // const wallet = new ethers.Wallet(privateKey, provider);

    // // Connect to MetaMask
    // if (typeof window.ethereum === "undefined") {
    //   throw new Error("MetaMask is not installed");
    // }
    // await window.ethereum.request({ method: "eth_requestAccounts" });
    // const provider = new ethers.providers.Web3Provider(window.ethereum);
    // const signer = provider.getSigner();

    // Create contract factory
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    console.log("Deploying contract...");
    // If your constructor takes arguments, add them here
    const contract = await factory.deploy(/* constructor arguments */);

    console.log("Transaction sent. Waiting for confirmation...");
    await contract.waitForDeployment;

    console.log("Contract deployed to:", contract.target);

    // Save the contract address to a file
    // fs.writeFileSync(
    //   path.join(compiledContractsDir, `${contractName}_Address.txt`),
    //   contract.address
    // );
  } catch (error) {
    console.error("Deployment failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
