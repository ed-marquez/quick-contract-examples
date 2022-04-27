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
	ContractCallQuery,
	TokenAssociateTransaction,
	TokenMintTransaction,
	TokenType,
} = require("@hashgraph/sdk");
const fs = require("fs");

const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
const operatorKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);
const treasuryId = AccountId.fromString(process.env.TREASURY_ID);
const treasuryKey = PrivateKey.fromString(process.env.TREASURY_PVKEY);

const client = Client.forTestnet().setOperator(operatorId, operatorKey);

async function main() {
	// STEP 1 ===================================
	console.log(`STEP 1 ===================================`);
	const bytecode = fs.readFileSync("./5_2_HIP218_NFT_sol_ERC721Contract.bin");
	console.log(`- Done \n`);

	// STEP 2 ===================================
	console.log(`STEP 2 ===================================`);
	//Create a fungible token
	const tokenCreateTx = await new TokenCreateTransaction()
		.setTokenName("hbarRocksNFT")
		.setTokenSymbol("HROK-NFT")
		.setTokenType(TokenType.NonFungibleUnique)
		.setInitialSupply(0)
		.setTreasuryAccountId(operatorId)
		.setAdminKey(operatorKey)
		.setSupplyKey(operatorKey)
		.freezeWith(client)
		.sign(operatorKey);
	const tokenCreateSubmit = await tokenCreateTx.execute(client);
	const tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
	const tokenId = tokenCreateRx.tokenId;
	const tokenAddressSol = tokenId.toSolidityAddress();
	console.log(`- NFT collection ID: ${tokenId}`);
	console.log(`- NFT collection ID in Solidity format: ${tokenAddressSol}`);

	// Token query
	const tokenInfo = await tQueryFcn(tokenId);
	console.log(`\n- NFT collection initial supply: ${tokenInfo.totalSupply.low}`);

	// IPFS CONTENT IDENTIFIER FOR WHICH WE WILL MINT NFT
	CID = [
		"ipfs://QmNPCiNA3Dsu3K5FxDPMG5Q3fZRwVTg14EXA92uqEeSRXn",
		"ipfs://QmZ4dgAgt8owvnULxnKxNe8YqpavtVCXmc1Lt2XajFpJs9",
		"ipfs://QmPzY5GxevjyfMUF5vEAjtyRoigzWp47MiKAtLBduLMC1T",
		"ipfs://Qmd3kGgSrAwwSrhesYcY7K54f3qD7MDo38r7Po2dChtQx5",
		"ipfs://QmWgkKz3ozgqtnvbCLeh7EaR1H8u5Sshx3ZJzxkcrT3jbw",
	];

	// MINT NEW BATCH OF NFTs
	nft = [];
	for (var i = 0; i < CID.length; i++) {
		nft[i] = await tokenMinterFcn(CID[i]);
		console.log(`-- Created NFT ${tokenId} with serial: ${nft[i].serials[0].low}`);
	}

	// // Associate Treasury ID with the token
	// const tokenAssociateTx = await new TokenAssociateTransaction()
	// 	.setAccountId(treasuryId)
	// 	.setTokenIds([tokenId])
	// 	.freezeWith(client)
	// 	.sign(treasuryKey);
	// const tokenAssociateSubmit = await tokenAssociateTx.execute(client);
	// const tokenAssociateRx = await tokenAssociateSubmit.getReceipt(client);
	// console.log(`\n- NFT collection association with Treasury: ${tokenAssociateRx.status}`);

	//Create a file on Hedera and store the contract bytecode
	const fileCreateTx = new FileCreateTransaction().setKeys([treasuryKey]).freezeWith(client);
	const fileCreateSign = await fileCreateTx.sign(treasuryKey);
	const fileCreateSubmit = await fileCreateSign.execute(client);
	const fileCreateRx = await fileCreateSubmit.getReceipt(client);
	const bytecodeFileId = fileCreateRx.fileId;
	console.log(`\n- Bytecode (from contract) file ID: ${bytecodeFileId}`);

	// Append contents to the file
	const fileAppendTx = new FileAppendTransaction()
		.setFileId(bytecodeFileId)
		.setContents(bytecode)
		.setMaxChunks(10)
		.freezeWith(client);
	const fileAppendSign = await fileAppendTx.sign(treasuryKey);
	const fileAppendSubmit = await fileAppendSign.execute(client);
	const fileAppendRx = await fileAppendSubmit.getReceipt(client);
	console.log(`- Bytecode content added: ${fileAppendRx.status} \n`);

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
	console.log(`- Smart contract ID: ${contractId}`);
	console.log(`- Smart contract ID in Solidity format: ${contractAddress} \n`);

	// STEP 4 ===================================
	console.log(`STEP 4 ===================================`);
	// Call HIP-218 functions using ContractCallQuery()
	const contractCallTx = new ContractCallQuery()
		.setContractId(contractId)
		.setGas(4000000)
		.setFunction("name", new ContractFunctionParameters().addAddress(tokenAddressSol))
		.setQueryPayment(new Hbar(1));
	const contractCallSubmit = await contractCallTx.execute(client);
	const contractCallResult = contractCallSubmit.getString();
	console.log(`- NFT collection name (using ContractCallQuery): ${contractCallResult}`);

	// Call HIP-218 functions using ContractCallQuery()
	const contractCallTx1 = new ContractCallQuery()
		.setContractId(contractId)
		.setGas(4000000)
		.setFunction("symbol", new ContractFunctionParameters().addAddress(tokenAddressSol))
		.setQueryPayment(new Hbar(1));
	const contractCallSubmit1 = await contractCallTx1.execute(client);
	const contractCallResult1 = contractCallSubmit1.getString();
	console.log(`\n- NFT collection symbol (using ContractCallQuery): ${contractCallResult1}`);

	// Call HIP-218 functions using ContractCallQuery()
	const contractCallTx2 = new ContractCallQuery()
		.setContractId(contractId)
		.setGas(4000000)
		.setFunction("totalSupply", new ContractFunctionParameters().addAddress(tokenAddressSol));
	const contractCallSubmit2 = await contractCallTx2.execute(client);
	const contractCallResult2 = contractCallSubmit2.getUint256();
	console.log(`\n- NFT collection supply (using ContractCallQuery): ${contractCallResult2}`);

	// Call HIP-218 functions using ContractCallQuery()
	const nftId = 3;
	const contractCallTx3 = new ContractCallQuery()
		.setContractId(contractId)
		.setGas(4000000)
		.setFunction(
			"ownerOf",
			new ContractFunctionParameters().addAddress(tokenAddressSol).addUint256(nftId)
		);
	const contractCallSubmit3 = await contractCallTx3.execute(client);
	const contractCallResult3 = contractCallSubmit3.getAddress();
	console.log(
		`\n- Owner of serial ${nftId} of ${tokenId} (using ContractCallQuery): \n-- in Solidity format ${contractCallResult3} \n-- in Hedera account ID format ${AccountId.fromSolidityAddress(
			contractCallResult3
		)}`
	);

	// Call HIP-218 functions using ContractCallQuery()
	const contractCallTx5 = new ContractCallQuery()
		.setContractId(contractId)
		.setGas(4000000)
		.setFunction(
			"balanceOf",
			new ContractFunctionParameters()
				.addAddress(tokenAddressSol)
				.addAddress(operatorId.toSolidityAddress())
		);
	const contractCallSubmit5 = await contractCallTx5.execute(client);
	const contractCallResult5 = contractCallSubmit5.getUint256();
	console.log(`\n- Operator NFT balance (using ContractCallQuery): ${contractCallResult5}`);

	console.log(`\nDONE ===================================\n`);

	// ========================================
	// HELPER FUNCTIONS
	async function tQueryFcn(tId) {
		let info = await new TokenInfoQuery().setTokenId(tId).execute(client);
		return info;
	}

	async function bCheckerFcn(aId) {
		let balanceCheckTx = await new AccountBalanceQuery().setAccountId(aId).execute(client);
		return balanceCheckTx.tokens._map.get(tokenId.toString());
	}

	async function tokenMinterFcn(CID) {
		const mintTx = new TokenMintTransaction()
			.setTokenId(tokenId)
			.setMetadata([Buffer.from(CID)])
			.freezeWith(client);
		const mintTxSubmit = await mintTx.execute(client);
		const mintRx = await mintTxSubmit.getReceipt(client);
		return mintRx;
	}
}
main();
