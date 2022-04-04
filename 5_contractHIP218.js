console.clear();
require("dotenv").config();
const {
	Client,
	AccountId,
	PrivateKey,
	TokenCreateTransaction,
	FileCreateTransaction,
	FileAppendTransaction,
	ContractCreateTransaction,
	ContractFunctionParameters,
	ContractExecuteTransaction,
	TokenInfoQuery,
	AccountBalanceQuery,
	Hbar,
	TransactionRecordQuery,
	ContractCallQuery,
} = require("@hashgraph/sdk");
const fs = require("fs");

const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
const operatorKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);
const treasuryId = AccountId.fromString(process.env.TREASURY_ID);
const treasuryKey = PrivateKey.fromString(process.env.TREASURY_PVKEY);

const client = Client.forTestnet().setOperator(operatorId, operatorKey);
client.setDefaultMaxTransactionFee(new Hbar(5));
client.setMaxQueryPayment(new Hbar(5));

async function main() {
	// STEP 1 ===================================
	console.log(`STEP 1 ===================================`);
	const bytecode = fs.readFileSync("./5_contractHIP218_sol_ERC20Contract.bin");
	console.log(`- Done \n`);

	// STEP 2 ===================================
	console.log(`STEP 2 ===================================`);
	//Create a fungible token
	const tokenCreateTx = await new TokenCreateTransaction()
		.setTokenName("hbarRocks")
		.setTokenSymbol("HROK")
		.setDecimals(0)
		.setInitialSupply(100)
		.setTreasuryAccountId(operatorId)
		.setAdminKey(operatorKey)
		.setSupplyKey(operatorKey)
		.freezeWith(client)
		.sign(operatorKey);
	const tokenCreateSubmit = await tokenCreateTx.execute(client);
	const tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
	const tokenId = tokenCreateRx.tokenId;
	const tokenAddressSol = tokenId.toSolidityAddress();
	console.log(`- Token ID: ${tokenId}`);
	console.log(`- Token ID in Solidity format: ${tokenAddressSol}`);

	// Token query
	const tokenInfo1 = await tQueryFcn(tokenId);
	console.log(`- Initial token supply: ${tokenInfo1.totalSupply.low} \n`);

	//Create a file on Hedera and store the contract bytecode
	const fileCreateTx = new FileCreateTransaction().setKeys([treasuryKey]).freezeWith(client);
	const fileCreateSign = await fileCreateTx.sign(treasuryKey);
	const fileCreateSubmit = await fileCreateSign.execute(client);
	const fileCreateRx = await fileCreateSubmit.getReceipt(client);
	const bytecodeFileId = fileCreateRx.fileId;
	console.log(`- The smart contract bytecode file ID is ${bytecodeFileId}`);

	// Append contents to the file
	const fileAppendTx = new FileAppendTransaction()
		.setFileId(bytecodeFileId)
		.setContents(bytecode)
		.setMaxChunks(10)
		.freezeWith(client);
	const fileAppendSign = await fileAppendTx.sign(treasuryKey);
	const fileAppendSubmit = await fileAppendSign.execute(client);
	const fileAppendRx = await fileAppendSubmit.getReceipt(client);
	console.log(`- Content added: ${fileAppendRx.status} \n`);

	// STEP 3 ===================================
	console.log(`STEP 3 ===================================`);
	// Create the smart contract
	const contractInstantiateTx = new ContractCreateTransaction()
		.setBytecodeFileId(bytecodeFileId)
		.setGas(3000000);
	const contractInstantiateSubmit = await contractInstantiateTx.execute(client);
	const contractInstantiateRx = await contractInstantiateSubmit.getReceipt(client);
	const contractId = contractInstantiateRx.contractId;
	const contractAddress = contractId.toSolidityAddress();
	console.log(`- The smart contract ID is: ${contractId}`);
	console.log(`- The smart contract ID in Solidity format is: ${contractAddress} \n`);

	// STEP 4 ===================================
	console.log(`STEP 4 ===================================`);

	// Execute HIP-218 functions using ContractExecuteTransaction()
	const contractExecTx = new ContractExecuteTransaction()
		.setContractId(contractId)
		.setGas(3000000)
		.setFunction("name", new ContractFunctionParameters().addAddress(tokenAddressSol));
	const contractExecSubmit = await contractExecTx.execute(client);
	const contractExecRec = await contractExecSubmit.getRecord(client);

	const txRec = await new TransactionRecordQuery()
		.setTransactionId(contractExecRec.transactionId)
		.setIncludeChildren(true)
		.execute(client);

	console.log(
		`- Token name with ContractExecute: ${txRec.children[0].contractFunctionResult.bytes.toString()}`
	);

	// ERROR: Call HIP-218 functions using ContractCallQuery() ERROR
	const contractCallTx = new ContractCallQuery()
		.setContractId(contractId)
		.setGas(3000000)
		.setFunction("name", new ContractFunctionParameters().addAddress(tokenAddressSol));
	const contractCallSubmit = await contractCallTx.execute(client);
	// const contractExecResult = await contractExecSubmit.getString(0);
	// console.log(`- Token name: ${contractExecResult}`);

	// ========================================
	// FUNCTIONS
	async function tQueryFcn(tId) {
		let info = await new TokenInfoQuery().setTokenId(tId).execute(client);
		return info;
	}

	async function bCheckerFcn(aId) {
		let balanceCheckTx = await new AccountBalanceQuery().setAccountId(aId).execute(client);
		return balanceCheckTx.tokens._map.get(tokenId.toString());
	}
}
main();
