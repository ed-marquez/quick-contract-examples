const fs = require("fs");
const {
	TokenCreateTransaction,
	FileCreateTransaction,
	FileAppendTransaction,
	AccountId,
	PrivateKey,
	ContractCreateTransaction,
	TokenType,
	TokenSupplyType,
	Hbar,
	Client,
	ContractId,
	AccountCreateTransaction,
	KeyList,
	ContractUpdateTransaction,
	ContractInfoQuery,
	ContractExecuteTransaction,
	ContractFunctionParameters,
	AccountBalanceQuery,
	TokenUpdateTransaction,
	TokenInfoQuery,
	TokenAssociateTransaction,
} = require("@hashgraph/sdk");
const dotenv = require("dotenv");

dotenv.config();

async function main() {
	const operatorKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);

	let client = Client.forTestnet().setOperator(
		AccountId.fromString(process.env.OPERATOR_ID),
		operatorKey
	);

	console.log(`\nSTEP 0 - Create accounts`);
	const adminKey = PrivateKey.generateED25519();
	const aliceKey = PrivateKey.generateED25519();

	let createAccountTx = await new AccountCreateTransaction()
		.setKey(adminKey.publicKey)
		.setInitialBalance(10)
		.execute(client);

	let createAccountRx = await createAccountTx.getReceipt(client);
	const adminAccount = createAccountRx.accountId;
	console.log(`- Admin account is ${adminAccount.toString()}`);

	createAccountTx = await new AccountCreateTransaction()
		.setKey(aliceKey.publicKey)
		.setMaxAutomaticTokenAssociations(1)
		.setInitialBalance(10)
		.execute(client);

	createAccountRx = await createAccountTx.getReceipt(client);
	const aliceAccount = createAccountRx.accountId;
	console.log(`- Alice account is ${aliceAccount.toString()}`);

	// switch client to admin
	client.setOperator(adminAccount, adminKey);

	console.log(`\nSTEP 1 - Create file`);
	const bytecode = fs.readFileSync("./MintTo_sol_MintTo.bin");

	//Create a file on Hedera and store the hex-encoded bytecode
	const fileCreateTx = await new FileCreateTransaction().setKeys([adminKey]).execute(client);
	const fileCreateRx = await fileCreateTx.getReceipt(client);
	const bytecodeFileId = fileCreateRx.fileId;
	console.log(`- The smart contract bytecode file ID is: ${bytecodeFileId}`);

	// Append contents to the file
	const fileAppendTx = await new FileAppendTransaction()
		.setFileId(bytecodeFileId)
		.setContents(bytecode)
		.setMaxChunks(10)
		.setMaxTransactionFee(new Hbar(2))
		.execute(client);
	await fileAppendTx.getReceipt(client);
	console.log(`- Content added`);

	console.log(`\nSTEP 2 - Create contract`);
	const contractCreateTx = await new ContractCreateTransaction()
		.setAdminKey(adminKey)
		.setBytecodeFileId(bytecodeFileId)
		.setGas(100000)
		.execute(client);

	const contractCreateRx = await contractCreateTx.getReceipt(client);
	const contractId = contractCreateRx.contractId.toString();
	console.log(`- Contract created ${contractId}`);

	console.log(`\nSTEP 3 - Create token`);
	const tokenCreateTx = await new TokenCreateTransaction()
		.setTokenName("test")
		.setTokenSymbol("tst")
		.setDecimals(0)
		.setInitialSupply(0)
		.setTokenType(TokenType.FungibleCommon)
		.setSupplyType(TokenSupplyType.Infinite)
		// create the token with the contract as supply and treasury
		// .setSupplyKey(ContractId.fromString(contractId))
		// .setTreasuryAccountId(contractId)
		// create the token with a key and account for treasury
		.setSupplyKey(adminKey)
		.setTreasuryAccountId(adminAccount)
		.setAdminKey(adminKey)
		.execute(client);

	const tokenCreateRx = await tokenCreateTx.getReceipt(client);
	const tokenId = tokenCreateRx.tokenId;
	console.log(`- Token created ${tokenId}`);

	// associate contract to token
	const associateTx = await new TokenAssociateTransaction()
		.setTokenIds([tokenId])
		.setAccountId(AccountId.fromString(contractId))
		.execute(client);

	await associateTx.getReceipt(client);

	// only update the token if it was setup with a key and account
	console.log(`\nSTEP 3.5 - Update the token`);
	const tokenUpdateTx = await new TokenUpdateTransaction()
		.setTokenId(tokenId)
		.setSupplyKey(ContractId.fromString(contractId))
		.setTreasuryAccountId(contractId)
		.execute(client);

	const tokenUpdateRx = await tokenUpdateTx.getReceipt(client);
	console.log(`- Token updated`);

	console.log(`\nSTEP 3.6 - Token Query`);
	const tokenInfo = await new TokenInfoQuery().setTokenId(tokenId).execute(client);

	console.log(`${tokenInfo.adminKey}`);
	console.log(`${tokenInfo.treasuryAccountId}`);

	console.log(`\nSTEP 4 - Update Contract`);

	const contractUpdateTx = await new ContractUpdateTransaction()
		.setContractId(contractId)
		.setAdminKey(new KeyList())
		.execute(client);
	await contractUpdateTx.getReceipt(client);

	console.log(`\nSTEP 4 - Query Contract`);
	const contractInfo = await new ContractInfoQuery().setContractId(contractId).execute(client);

	console.log(`- contract admin key is now ${contractInfo.adminKey}`);

	console.log(`\n STEP 4 - call the contract to set the token id`);

	let contractFunctionParameters = new ContractFunctionParameters().addAddress(
		tokenId.toSolidityAddress()
	);

	const contractTokenTx = await new ContractExecuteTransaction()
		.setContractId(contractId)
		.setFunction("setToken", contractFunctionParameters)
		.setGas(500000)
		.execute(client);
	await contractTokenTx.getReceipt(client);

	console.log(`\n STEP 5 - minting 1 to Alice`);

	contractFunctionParameters = new ContractFunctionParameters().addAddress(
		aliceAccount.toSolidityAddress()
	);

	// switch client to alice
	client.setOperator(aliceAccount, aliceKey);

	const contractMintTx = await new ContractExecuteTransaction()
		.setContractId(contractId)
		.setFunction("mintTo", contractFunctionParameters)
		.setGas(500000)
		.execute(client);
	await contractMintTx.getReceipt(client);

	console.log(`\n STEP 6 - Alice Balance`);

	const aliceBalance = await new AccountBalanceQuery().setAccountId(aliceAccount).execute(client);

	console.log(aliceBalance);
}

main();
