console.clear();
require("dotenv").config();
const {
	AccountId,
	PrivateKey,
	Client,
	FileCreateTransaction,
	ContractCreateTransaction,
	ContractCallQuery,
	TransferTransaction,
	ContractInfoQuery,
} = require("@hashgraph/sdk");
const fs = require("fs");

// Configure accounts and client
const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
const operatorKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);
const treasuryId = AccountId.fromString(process.env.TREASURY_ID);
const treasuryKey = PrivateKey.fromString(process.env.TREASURY_PVKEY);

const client = Client.forTestnet().setOperator(operatorId, operatorKey);

async function main() {
	// Import the compiled contract bytecode
	const contractBytecode = fs.readFileSync(
		"0_transferHbar2Contract_viaCryptoTrans_sol_hbar2Contract.bin"
	);

	const fileID = await createFile(contractBytecode);
	const contractID = await initContract(fileID);
	await transferToContract(contractID);

	const { contractInfoQueryBal, getBalanceBal } = await getBalances(contractID);
	console.log(`- Contract balance (from getBalance fcn): ${getBalanceBal} \n`);
	console.log(`- Contract balance (from ContractInfoQuery): ${contractInfoQueryBal} \n`);
}
main();


// Create a file on Hedera and store the bytecode
async function createFile(bytecode) {
	const fileCreateTx = new FileCreateTransaction()
		.setContents(bytecode)
		.setKeys([operatorKey])
		.freezeWith(client);
	const fileCreateSign = await fileCreateTx.sign(operatorKey);
	const fileCreateSubmit = await fileCreateSign.execute(client);
	const fileCreateRx = await fileCreateSubmit.getReceipt(client);
	const bytecodeFileId = fileCreateRx.fileId;
	console.log(`- The bytecode file ID is: ${bytecodeFileId} \n`);
	return bytecodeFileId
}

// Instantiate the smart contract
async function initContract(fileID) {
	const contractInstantiateTx = new ContractCreateTransaction()
		.setBytecodeFileId(fileID)
		.setGas(100000);
	const contractInstantiateSubmit = await contractInstantiateTx.execute(client);
	const contractInstantiateRx = await contractInstantiateSubmit.getReceipt(client);
	const contractId = contractInstantiateRx.contractId;
	const contractAddress = contractId.toSolidityAddress();
	console.log(`- The smart contract ID is: ${contractId} \n`);
	console.log(`- The smart contract ID in Solidity format is: ${contractAddress} \n`);
	return contractId;
}

// Transfer HBAR to smart contract using TransferTransaction()
async function transferToContract(contractId) {
		const contractExecuteTx = new TransferTransaction()
		.addHbarTransfer(treasuryId, -10)
		.addHbarTransfer(contractId, 10)
		.freezeWith(client);
	const contractExecuteSign = await contractExecuteTx.sign(treasuryKey);
	const contractExecuteSubmit = await contractExecuteSign.execute(client);
	const contractExecuteRx = await contractExecuteSubmit.getReceipt(client);
	console.log(`- Crypto transfer to contract: ${contractExecuteRx.status} \n`);
}

// Query the contract balance calling the function in the contract
async function getBalances(contractId) {
	const contractQueryTx = new ContractCallQuery()
		.setContractId(contractId)
		.setGas(100000)
		.setFunction("getBalance");
	const contractQuerySubmit = await contractQueryTx.execute(client);
	const getBalanceBal = contractQuerySubmit.getUint256(0);
	

	const cCheck = await new ContractInfoQuery().setContractId(contractId).execute(client);
	const contractInfoQueryBal = cCheck.balance.toString();
	
	return {
		contractInfoQueryBal,
		getBalanceBal 
	}
}
