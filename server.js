const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const { Readable } = require("stream");
const { createParser } = require("eventsource-parser");
const fs = require("fs");
const { exec } = require("child_process");
const solc = require("solc");
const ethers = require("ethers");
require("dotenv").config();

const envfile = require("envfile");
const stream = require("stream");
stream.setMaxListeners(0);

const app = express();
app.use(cors());
app.use(bodyParser.json());

let clients = [];
let messages = [];

// SSE Event Handler
const eventsHandler = (req, res) => {
  const headers = {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  };
  res.writeHead(200, headers);

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res,
  };
  clients.push(newClient);

  req.on("close", () => {
    console.log(`${clientId} Connection closed`);
    clients = clients.filter((client) => client.id !== clientId);
  });
};

// Send events to all clients
const sendEventsToAll = (newMessage) => {
  clients.forEach((client) =>
    client.res.write(`data: ${JSON.stringify(newMessage)}\n\n`)
  );
};

app.get("/events", eventsHandler);
app.post("/api/send", async (req, res) => {
  try {
    const { role, content } = req.body;

    // Add the new message to the messages array
    const newMessage = { role, content };
    messages.push(newMessage);

    // Send the complete user message to all connected clients
    sendEventsToAll(newMessage);

    // If the message is from a user, generate a response using the Mistral API
    if (role === "user") {
      const language = content.toLowerCase().includes("vyper")
        ? "vyper"
        : "solidity";
      const response = await MistralStream(
        MISTRAL_URL,
        MISTRAL_API_KEY,
        "codestral-latest",
        messages
      );

      let accumulatedResponse = "";

      // Process the response and accumulate it
      for await (const chunk of response) {
        accumulatedResponse += chunk.toString();
      }

      // Send the complete accumulated response to clients
      const assistantMessage = {
        role: "assistant",
        content: accumulatedResponse,
      };
      messages.push(assistantMessage);
      sendEventsToAll(assistantMessage);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in /api/send:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.post("/api/store-private-key", (req, res) => {
  const { privateKey } = req.body;

  // Validate if privateKey is provided
  if (!privateKey) {
    return res.status(400).json({ error: "Private key is required" });
  }

  try {
    // Store the private key securely (for example, in .env file)
    fs.writeFileSync(".env", `PRIVATE_KEY="${privateKey}"\n`, { flag: "a" });

    // Optionally, you can use exec to perform additional operations
    async function installLibs() {
      await exec("sh", ["./scripts/install.sh"]);
    }
    installLibs();

    // Respond with a success message
    res.status(200).json({ message: "Private key stored successfully" });
  } catch (error) {
    console.error("Error storing private key:", error);
    res.status(500).json({ error: "Failed to store private key" });
  }
});

app.post("/api/deploy", async (req, res) => {
  const { signerAddress } = req.body; // Assuming the signature is handled elsewhere
  console.log(req.body);

  try {
    // Read contract code from file
    const contractCode = fs.readFileSync("./contracts/Contract.sol", "utf8");
    console.log("Contract Read");
    console.log(contractCode);

    if (!contractCode || typeof contractCode !== "string") {
      throw new Error("Failed to read contract code.");
    }

    async function installLibs() {
      await exec("sh", ["./scripts/install.sh"]);
    }
    await installLibs();
    console.log("Libs Installed");

    // Compile the contract from the received code
    const { abi, bytecode } = compileContract(contractCode);

    console.log("Compiled Contract");

    // Initialize MetaMask and connect
    const provider = new ethers.JsonRpcProvider(process.env.INFURIA_URL);
    console.log(`Provider : ${provider}`);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`Wallet Created`);
    console.log(`Wallet : ${wallet}`);

    // Deploy the contract using ethers.js with MetaMask signer
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    console.log("Contract Deployed");

    res.status(200).json({ address: contract.target });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Deployment failed" });
  }
});

// Function to compile Solidity contract
function compileContract(contractCode) {
  if (!contractCode.trim()) {
    throw new Error("Contract code is empty.");
  }

  const input = {
    language: "Solidity",
    sources: {
      "contract.sol": {
        content: contractCode,
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

  try {
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (!output.contracts || !output.contracts["contract.sol"]) {
      console.error("Compilation output:", output);
      throw new Error("Compilation failed. No contracts found.");
    }

    const compiledContracts = output.contracts["contract.sol"];

    const contractNames = Object.keys(compiledContracts);
    if (contractNames.length === 0) {
      throw new Error("No contracts found in the file.");
    }

    const contractName = contractNames[0];
    const contract = compiledContracts[contractName];
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    return { abi, bytecode };
  } catch (error) {
    console.error("Compilation error:", error);
    throw new Error("Failed to compile contract.");
  }
}

const MISTRAL_URL = process.env.MISTRAL_URL;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

function extractCode(inputText, language) {
  const regex = new RegExp(`\`\`\`${language}([\\s\\S]*?)\`\`\``);
  const match = regex.exec(inputText);
  return match ? match[1].trim() : null;
}

function findBash(inputText) {
  const bash = /```bash([\s\S]*?)```/.exec(inputText);
  return bash ? bash[1].trim() : null;
}

const handler = async (req, res) => {
  try {
    const { messages, language } = req.body;

    const prefix = `You are a Senior Blockchain Developer with a wealth of experience in creating secure and robust smart contracts in ${
      language === "vyper" ? "Vyper" : "Solidity"
    } for various industries. 
    Your task is to generate production-level Smart Contracts with all the advanced features and security measures in place for immediate deployment.

    Please follow this detailed structure to create top-notch smart contracts that meet all the necessary criteria:

    ---

    ## Smart Contract Description
    ${messages[messages.length - 1].content}

    ## Security Features Implemented
    - Input validation
    - Secure data handling
    - Prevention of reentrancy issues
    - Compliance with best practices

    ## Efficiency and Documentation
    - Well-structured and efficient code
    - Comprehensive documentation
    - Error handling for exceptions
    - Gas-efficient design

    ## Specific Smart Contract Requirements
    - Token standards (ERC-20, ERC-721, etc.)
    - Access control mechanisms
    - Unique functionalities as per use case

    ## Code Structure and Testing
    - Modular and reusable code
    - Scalability and flexibility focus
    - Thorough testing for vulnerabilities and bugs

    ## Comments and Documentation
    - Detailed comments within the code
    - Documentation for easy understanding and future updates

    ---

    Your task is to create impeccable smart contracts in ${
      language === "vyper" ? "Vyper" : "Solidity"
    } that encompass these aspects. 
    ${
      language === "solidity"
        ? "Do Ensure that you first provide the necessary commands to install all the libraries that you have mentioned code"
        : ""
    }
    Dive deep into the specifics and ensure that the final product is of the highest quality and ready for deployment. 
    Always generate the code in the following format: \`\`\`${language}([\s\S]*?)\`\`\`
    ${"The bash commands to install the necessary libraries should be in format: ```bash([sS]*?)```"}`;

    const stream = await MistralStream(
      MISTRAL_URL,
      MISTRAL_API_KEY,
      "codestral-latest",
      [...messages, { role: "user", content: prefix }]
    );
    res.setHeader("Content-Type", "application/json");
    stream.pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error");
  }
};

const MistralStream = async (apiUrl, apiKey, model, messages) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const response = await fetch(apiUrl, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    method: "POST",
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: true,
    }),
  });

  if (response.status !== 200) {
    throw new Error(
      `Mistral API error: ${response.status} ${response.statusText}`
    );
  }

  const readable = new Readable({
    async read() {
      let aiResponse = "";

      const onParse = (event) => {
        if (event.type === "event") {
          const data = event.data;
          if (data === "[DONE]") {
            this.push(null);
            return;
          }
          try {
            const json = JSON.parse(data);
            const text = json.choices[0]?.delta?.content || "";
            aiResponse += text;
            this.push(encoder.encode(text));
          } catch (e) {
            this.destroy(e);
          }
        }
      };

      const parser = createParser(onParse);
      for await (const chunk of response.body) {
        const str = decoder.decode(chunk);
        parser.feed(str);
      }

      const language = messages[messages.length - 1].content
        .toLowerCase()
        .includes("vyper")
        ? "vyper"
        : "solidity";
      const code = extractCode(aiResponse, language);
      const bashScript = language === "solidity" ? findBash(aiResponse) : null;

      const responsePayload = {
        code,
        bashScript,
      };

      // Save AI-generated code to a file
      if (code) {
        const codeFilePath = "./contracts/Contract.sol";
        fs.writeFileSync(codeFilePath, code, "utf8");
      }

      // Save bash script to a file
      if (bashScript) {
        const bashScriptPath = "./scripts/install.sh";
        fs.writeFileSync(bashScriptPath, bashScript, "utf8");
      }

      const responseText = JSON.stringify(responsePayload);
      this.push(encoder.encode(responseText));
      this.push(null);
    },
  });

  return readable;
};

app.post("/api/handler", handler);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
