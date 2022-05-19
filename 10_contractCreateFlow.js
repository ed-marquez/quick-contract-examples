const fs = require("fs");
const {
  Client,
  PrivateKey,
  ContractFunctionParameters,
  AccountId,
  ContractCreateFlow,
} = require("@hashgraph/sdk");
const dotenv = require("dotenv");
dotenv.config();

const main = async () => {
  const myAccountId = AccountId.fromString(process.env.OPERATOR_ID);
  const myPrivateKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);

  // The Hedera JS SDK makes this really easy!
  const client = Client.forTestnet();
  client.setOperator(myAccountId, myPrivateKey);

  console.log("- Deploying contract using ContractCreateFlow");
  const bytecode = fs.readFileSync("./8_MintTo_sol_MintTo.bin");
  //Create the transaction
  const contractCreate = new ContractCreateFlow()
    .setGas(100000)
    .setConstructorParameters(
      new ContractFunctionParameters().addAddress(
        myAccountId.toSolidityAddress()
      )
    )
    .setBytecode(bytecode);

  //Sign the transaction with the client operator key and submit to a Hedera network
  const txResponse = await contractCreate.execute(client);
  //Get the receipt of the transaction
  const receipt = await txResponse.getReceipt(client);
  //Get the new contract ID
  const newContractId = receipt.contractId;
  console.log("The new contract ID is " + newContractId);
};

main();
