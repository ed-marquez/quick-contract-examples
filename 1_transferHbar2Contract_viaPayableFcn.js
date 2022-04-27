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
	TransactionRecordQuery,
	ContractInfoQuery,
	TokenAssociateTransaction,
	TransferTransaction,
} = require("@hashgraph/sdk");
const fs = require("fs");

const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
const operatorKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);
const treasuryId = AccountId.fromString(process.env.TREASURY_ID);
const treasuryKey = PrivateKey.fromString(process.env.TREASURY_PVKEY);
const aliceId = AccountId.fromString(process.env.ALICE_ID);
const aliceyKey = PrivateKey.fromString(process.env.ALICE_PVKEY);

const client = Client.forTestnet().setOperator(operatorId, operatorKey);

async function main() {
	// STEP 1 ===================================
	console.log(`STEP 1 ===================================`);
	const bytecode = fs.readFileSync("./1_transferHbar2Contract_viaPayableFcn_sol_hbar2Contract.bin");
	console.log(`- Done \n`);

	// STEP 2 ===================================
	console.log(`STEP 2 ===================================`);
	//Create a fungible token
	const tokenCreateTx = await new TokenCreateTransaction()
		.setTokenName("hbarRocks")
		.setTokenSymbol("HROK")
		.setDecimals(0)
		.setInitialSupply(100)
		.setTreasuryAccountId(treasuryId)
		.setAdminKey(treasuryKey)
		.setSupplyKey(treasuryKey)
		.freezeWith(client)
		.sign(treasuryKey);
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
		.setAdminKey(treasuryKey)
		.setGas(3000000)
		.setConstructorParameters(new ContractFunctionParameters().addAddress(tokenAddressSol))
		.freezeWith(client);
	const contractInstantiateSign = await contractInstantiateTx.sign(treasuryKey);
	const contractInstantiateSubmit = await contractInstantiateSign.execute(client);
	const contractInstantiateRx = await contractInstantiateSubmit.getReceipt(client);
	const contractId = contractInstantiateRx.contractId;
	const contractAddress = contractId.toSolidityAddress();
	console.log(`- The smart contract ID is: ${contractId}`);
	console.log(`- The smart contract ID in Solidity format is: ${contractAddress} \n`);

	const contractAssociateTx = new TokenAssociateTransaction()
		.setTokenIds([tokenId])
		.setAccountId(AccountId.fromString(contractId))
		.freezeWith(client);
	const contractAssociateSign = await contractAssociateTx.sign(treasuryKey);
	const contractAssociateSubmit = await contractAssociateSign.execute(client);
	const contractAssociateRx = await contractAssociateSubmit.getReceipt(client);
	console.log(`- Contract associated with token: ${contractAssociateRx.status}`);

	// Token query 2.1
	const tokenInfo2p1 = await tQueryFcn(tokenId);
	console.log(`- Token supply key: ${tokenInfo2p1.supplyKey.toString()}`);

	// Update Token: SMART CONTRACT TO BE THE SUPPLY KEY AND TRESURY ACCOUNT
	// For this to be possible, the contract must be associated with the
	// token, the contract must have an admin key, and the admin key of the
	// contract must sign this tx
	const tokenUpdateTx = await new TokenUpdateTransaction()
		.setTokenId(tokenId)
		.setSupplyKey(contractId)
		.setTreasuryAccountId(AccountId.fromSolidityAddress(contractAddress))
		// .setAdminKey(contractId)
		.freezeWith(client)
		.sign(treasuryKey);
	const tokenUpdateSubmit = await tokenUpdateTx.execute(client);
	const tokenUpdateRx = await tokenUpdateSubmit.getReceipt(client);
	console.log(`- Token update status: ${tokenUpdateRx.status}`);

	// Token query 2.2
	const tokenInfo2p2 = await tQueryFcn(tokenId);
	console.log(`- Token supply key: ${tokenInfo2p2.supplyKey.toString()} \n`);

	// STEP 4 ===================================
	console.log(`STEP 4 ===================================`);
	//Execute a contract function (mint)
	const contractExecTx = new ContractExecuteTransaction()
		.setContractId(contractId)
		.setGas(3000000)
		.setFunction("mintFungibleToken", new ContractFunctionParameters().addUint64(150));
	const contractExecSubmit = await contractExecTx.execute(client);
	const contractExecRx = await contractExecSubmit.getReceipt(client);
	console.log(`- New tokens minted: ${contractExecRx.status.toString()}`);
	const contractExecRec = await contractExecSubmit.getRecord(client);
	const recQuery = await new TransactionRecordQuery()
		.setTransactionId(contractExecRec.transactionId)
		.setIncludeChildren(true)
		.execute(client);

	// Token query 3
	const tokenInfo3 = await tQueryFcn(tokenId);
	console.log(`- New token supply: ${tokenInfo3.totalSupply.low} \n`);

	//Execute a contract function (associate)
	const contractExecTx1 = new ContractExecuteTransaction()
		.setContractId(contractId)
		.setGas(3000000)
		.setFunction(
			"tokenAssociate",
			new ContractFunctionParameters().addAddress(aliceId.toSolidityAddress())
		)
		.freezeWith(client);
	const contractExecSign1 = await contractExecTx1.sign(aliceyKey);
	const contractExecSubmit1 = await contractExecSign1.execute(client);
	const contractExecRx1 = await contractExecSubmit1.getReceipt(client);
	console.log(
		`- Token association with Alice (via precompile): ${contractExecRx1.status.toString()} \n`
	);
	const contractExecRec1 = await contractExecSubmit1.getRecord(client);
	const recQuery1 = await new TransactionRecordQuery()
		.setTransactionId(contractExecRec1.transactionId)
		.setIncludeChildren(true)
		.execute(client);

	//Execute a contract function (transfer)
	const contractExecTx2 = new ContractExecuteTransaction()
		.setContractId(contractId)
		.setGas(3000000)
		.setPayableAmount(12.34)
		.setFunction(
			"tokenTransfer",
			new ContractFunctionParameters()
				.addAddress(contractAddress)
				.addAddress(aliceId.toSolidityAddress())
				.addInt64(50)
		)
		.freezeWith(client);
	const contractExecSubmit2 = await contractExecTx2.execute(client);
	const contractExecRx2 = await contractExecSubmit2.getReceipt(client);
	const contractExecRec2 = await contractExecSubmit2.getRecord(client);
	const recQuery2 = await new TransactionRecordQuery()
		.setTransactionId(contractExecRec2.transactionId)
		.setIncludeChildren(true)
		.execute(client);

	console.log(`- Token transfer from Contract to Alice: ${contractExecRx2.status.toString()}`);

	const cCheck = await new ContractInfoQuery().setContractId(contractId).execute(client);
	console.log(
		`- Contract balance: ${
			cCheck.tokenRelationships._map.get(tokenId.toString()).balance.low
		} units of token ${tokenId}`
	);

	const tB = await bCheckerFcn(aliceId);
	console.log(`- Alice balance: ${tB} units of token ${tokenId} \n`);

	console.log(`- HBAR in Contract: ${cCheck.balance.toString()}`);

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
