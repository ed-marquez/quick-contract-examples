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
	TokenUpdateTransaction,
	ContractExecuteTransaction,
	TokenInfoQuery,
	AccountBalanceQuery,
	Hbar,
	AccountCreateTransaction,
	AccountUpdateTransaction,
	AccountInfoQuery,
	ContractInfoQuery,
	ContractUpdateTransaction,
	KeyList,
	ContractDeleteTransaction,
} = require("@hashgraph/sdk");
const fs = require("fs");

const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
const operatorKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);
const treasuryId = AccountId.fromString(process.env.TREASURY_ID);
const treasuryKey = PrivateKey.fromString(process.env.TREASURY_PVKEY);
const aliceId = AccountId.fromString(process.env.ALICE_ID);
const aliceyKey = PrivateKey.fromString(process.env.ALICE_PVKEY);

const client = Client.forTestnet().setOperator(operatorId, operatorKey);

// Makes the contract the supply key for an immutable token during token creation
async function main() {
	// STEP 1 ===================================
	console.log(`STEP 1 ===================================`);
	const bytecode = fs.readFileSync(
		"./7_mintTo_immutableContractAndFToken_HbarTransSetPayable_sol_mintAssocTransImmutableTok.bin"
	);
	console.log(`- Done \n`);

	// STEP 2 ===================================
	console.log(`STEP 2 ===================================`);

	//Create a file on Hedera and store the hex-encoded bytecode
	const fileCreateTx = new FileCreateTransaction().setKeys([treasuryKey]).freezeWith(client);
	const fileCreateSign = await fileCreateTx.sign(treasuryKey);
	const fileSubmit = await fileCreateSign.execute(client);
	const fileCreateRx = await fileSubmit.getReceipt(client);
	const bytecodeFileId = fileCreateRx.fileId;
	console.log(`- The smart contract bytecode file ID is: ${bytecodeFileId}`);

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
		.setGas(3000000)
		.setAdminKey(treasuryKey)
		.freezeWith(client);
	const contractInstantiateSign = await contractInstantiateTx.sign(treasuryKey);
	const contractInstantiateSubmit = await contractInstantiateSign.execute(client);
	const contractInstantiateRx = await contractInstantiateSubmit.getReceipt(client);
	const contractId = contractInstantiateRx.contractId;
	const contractAddress = contractId.toSolidityAddress();
	console.log(`- The smart contract ID is: ${contractId}`);
	console.log(`- The smart contract ID in Solidity format is: ${contractAddress} \n`);

	//Create a fungible/immutable token
	const tokenCreateTx = await new TokenCreateTransaction()
		.setTokenName("hbarRocks")
		.setTokenSymbol("HROK")
		.setDecimals(0)
		.setInitialSupply(1000)
		.setTreasuryAccountId(AccountId.fromSolidityAddress(contractAddress))
		.setSupplyKey(contractId)
		// .setAdminKey(contractId) (NOT POSSIBLE YET)
		.freezeWith(client)
		.sign(treasuryKey);
	const tokenCreateSubmit = await tokenCreateTx.execute(client);
	const tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
	const tokenId = tokenCreateRx.tokenId;
	const tokenAddressSol = tokenId.toSolidityAddress();
	console.log(`- Token ID: ${tokenId}`);
	console.log(`- Token ID in Solidity format: ${tokenAddressSol}`);

	// Token query 1
	const tokenInfo1 = await tQueryFcn(tokenId);
	console.log(`- Initial token supply: ${tokenInfo1.totalSupply.low} \n`);
	console.log(`- New token supply key: ${tokenInfo1.supplyKey.toString()} \n`);
	console.log(`- New token Treasury: ${tokenInfo1.treasuryAccountId} \n`);

	// STEP 3.1 ===================================
	console.log(`STEP 3.1 ===================================`);

	const contractInfo = await new ContractInfoQuery().setContractId(contractId).execute(client);
	console.log(`- Contract admin key is: ${contractInfo.adminKey}`);

	// Update the contract key
	const contractUpdateTx = new ContractUpdateTransaction()
		.setContractId(contractId)
		.setAdminKey(new KeyList())
		.freezeWith(client);
	const contractUpdateTxSign = await contractUpdateTx.sign(treasuryKey);
	const contractUpdateSubmit = await contractUpdateTxSign.execute(client);
	const contractUpdateRx = await contractUpdateSubmit.getReceipt(client);
	console.log(`- Contract updated: ${contractUpdateRx.status}`);

	const contractInfo1 = await new ContractInfoQuery().setContractId(contractId).execute(client);
	console.log(`- New contract admin key is now: ${contractInfo1.adminKey}`);

	// // TEST CONTRACT IMMUTABILITY: Delete the contract
	// const contractUpdateTx1 = new ContractDeleteTransaction()
	// 	.setContractId(contractId)
	// 	.freezeWith(client);
	// const contractUpdateTxSign1 = await contractUpdateTx1.sign(treasuryKey);
	// const contractUpdateSubmit1 = await contractUpdateTxSign1.execute(client);
	// const contractUpdateRx1 = await contractUpdateSubmit1.getReceipt(client);
	// console.log(`- Contract deleted: ${contractUpdateRx1.status}`);

	// STEP 4 ===================================
	console.log(`STEP 4 ===================================`);
	//Execute a contract function (setToken)
	const contractExecTx = new ContractExecuteTransaction()
		.setContractId(contractId)
		.setGas(3000000)
		.setFunction("setToken", new ContractFunctionParameters().addAddress(tokenAddressSol));
	const contractExecSubmit = await contractExecTx.execute(client);
	const contractExecRx = await contractExecSubmit.getReceipt(client);
	console.log(`- Token ID set in contract: ${contractExecRx.status.toString()} \n`);

	//Switch client to Alice to pay for contract execution
	client.setOperator(aliceId, aliceyKey);

	// Check HBAR balances before contract execution
	oB = await bCheckerFcn(operatorId);
	tB = await bCheckerFcn(treasuryId);
	aB = await bCheckerFcn(aliceId);
	cB = await cCheckerFcn(contractId);
	console.log(`- Operator balance: ${oB[0]}`);
	console.log(`- Treasury balance: ${tB[0]}`);
	console.log(`- Alice balance: ${aB[0]}`);
	console.log(`- Contract balance: ${cB[0]}`);

	//Execute a contract function (mintTo)
	const contractFunctionParams = new ContractFunctionParameters()
		.addInt64(150)
		.addAddress(aliceId.toSolidityAddress());
	const contractExecTx1 = new ContractExecuteTransaction()
		.setContractId(contractId)
		.setGas(3000000)
		.setFunction("mintTo", contractFunctionParams)
		.setPayableAmount(12.4);
	const contractExecSubmit1 = await contractExecTx1.execute(client);
	const contractExecRx1 = await contractExecSubmit1.getReceipt(client);
	console.log(`\n- New tokens minted: ${contractExecRx1.status.toString()}`);

	//Switch client back to Operator
	client.setOperator(operatorId, operatorKey);

	// Token query 3
	const tokenInfo3 = await tQueryFcn(tokenId);
	console.log(`- New token supply: ${tokenInfo3.totalSupply.low} \n`);

	// Check token balances
	cB = await cCheckerFcn(contractId);
	aB = await bCheckerFcn(aliceId);
	console.log(`- Contract balance: ${cB[1]} units of token ${tokenId}`);
	console.log(`- Alice balance: ${aB[1]} units of token ${tokenId} \n`);

	// Check HBAR balances before contract execution
	oB = await bCheckerFcn(operatorId);
	tB = await bCheckerFcn(treasuryId);
	aB = await bCheckerFcn(aliceId);
	cB = await cCheckerFcn(contractId);
	console.log(`- Operator balance: ${oB[0]}`);
	console.log(`- Treasury balance: ${tB[0]}`);
	console.log(`- Alice balance: ${aB[0]}`);
	console.log(`- Contract balance: ${cB[0]}`);
	// ========================================
	// FUNCTIONS

	async function tQueryFcn(tId) {
		let info = await new TokenInfoQuery().setTokenId(tId).execute(client);
		return info;
	}

	async function bCheckerFcn(aId) {
		let balanceCheckTx = await new AccountBalanceQuery().setAccountId(aId).execute(client);
		return [balanceCheckTx.hbars.toString(), balanceCheckTx.tokens._map.get(tokenId.toString())];
	}

	async function cCheckerFcn(cId) {
		let balanceCheckTx = await new ContractInfoQuery().setContractId(cId).execute(client);
		return [
			balanceCheckTx.balance.toString(),
			balanceCheckTx.tokenRelationships._map.get(tokenId.toString()).balance.low,
		];
	}
}
main();
