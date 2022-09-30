console.clear();
require("dotenv").config();
const {
	Client,
	AccountId,
	PrivateKey,
	TokenCreateTransaction,
	ContractExecuteTransaction,
	TokenInfoQuery,
	AccountBalanceQuery,
	Hbar,
	TransactionRecordQuery,
	ContractInfoQuery,
	TokenAssociateTransaction,
	TransferTransaction,
	ContractCreateFlow,
	AccountAllowanceApproveTransaction,
	AccountInfoQuery,
	TopicCreateTransaction,
	TokenMintTransaction,
	NftId,
	TokenType,
	AccountAllowanceDeleteTransaction,
	ContractFunctionParameters,
	AccountCreateTransaction,
	TransactionId,
} = require("@hashgraph/sdk");
const fs = require("fs");

const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
const operatorKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);

const client = Client.forTestnet().setOperator(operatorId, operatorKey);
client.setDefaultMaxTransactionFee(new Hbar(100));

async function main() {
	// STEP 1 ===================================
	console.log(`STEP 1 ===================================`);
	const bytecode = fs.readFileSync("./0_test_sol_test.bin");

	const initBalance = new Hbar(10);
	const aliceKey = PrivateKey.generateED25519();
	const [aliceSt, aliceId] = await accountCreateFcn(aliceKey, initBalance, client);
	console.log(`- Alice's account: https://hashscan.io/#/testnet/account/${aliceId}`);
	const bobKey = PrivateKey.generateED25519();
	const [bobSt, bobId] = await accountCreateFcn(bobKey, initBalance, client);
	console.log(`- Bob's account: https://hashscan.io/#/testnet/account/${bobId}`);
	const treasuryKey = PrivateKey.generateED25519();
	const [treasurySt, treasuryId] = await accountCreateFcn(treasuryKey, initBalance, client);
	console.log(`- Treasury's account: https://hashscan.io/#/testnet/account/${treasuryId}`);

	console.log(`- Done \n`);

	// STEP 2 ===================================
	console.log(`STEP 2 ===================================`);
	//Create a token
	const [tokenId, tokenInfo] = await nftCreateMint();
	const tokenAddressSol = tokenId.toSolidityAddress();
	// console.log(`- Token ID: ${tokenId}`);
	// console.log(`- Initial token supply: ${tokenInfo.totalSupply.low} \n`);
	console.log(`- Token ID in Solidity format: ${tokenAddressSol}`);

	// STEP 3 ===================================
	console.log(`STEP 3 ===================================`);
	// Create the smart contract
	const contractCreateTx = new ContractCreateFlow().setBytecode(bytecode).setGas(3000000);
	const contractCreateSubmit = await contractCreateTx.execute(client);
	const contractCreateRx = await contractCreateSubmit.getReceipt(client);
	const contractId = contractCreateRx.contractId;
	const contractAddress = contractId.toSolidityAddress();
	console.log(`- The smart contract ID is: ${contractId}`);
	console.log(`- The smart contract ID in Solidity format is: ${contractAddress} \n`);

	// const tokenAssociateTx = new TokenAssociateTransaction()
	// 	.setTokenIds([tokenId])
	// 	.setAccountId(aliceId)
	// 	.freezeWith(client);
	// const tokenAssociateSign = await tokenAssociateTx.sign(aliceKey);
	// const tokenAssociateSubmit = await tokenAssociateSign.execute(client);
	// const tokenAssociateRx = await tokenAssociateSubmit.getReceipt(client);
	// console.log(`- Alice associated with token: ${tokenAssociateRx.status}`);

	// const tokenAssociateTxBob = new TokenAssociateTransaction()
	// 	.setTokenIds([tokenId])
	// 	.setAccountId(bobId)
	// 	.freezeWith(client);
	// const tokenAssociateSignBob = await tokenAssociateTxBob.sign(bobKey);
	// const tokenAssociateSubmitBob = await tokenAssociateSignBob.execute(client);
	// const tokenAssociateRxBob = await tokenAssociateSubmitBob.getReceipt(client);
	// console.log(`- Bob associated with token: ${tokenAssociateRxBob.status}`);

	// // Execute a contract function
	// const contractExecTx0 = new ContractExecuteTransaction()
	// 	.setContractId(contractId)
	// 	.setGas(3000000)
	// 	.setFunction(
	// 		"tokenAssociate",
	// 		new ContractFunctionParameters()
	// 			.addAddress(aliceId.toSolidityAddress())
	// 			.addAddress(tokenAddressSol)
	// 	)
	// 	.freezeWith(client);
	// const contractExecSign0 = await contractExecTx0.sign(aliceKey);
	// const contractExecSubmit0 = await contractExecSign0.execute(client);
	// const contractExecRec0 = await contractExecSubmit0.getRecord(client);
	// const recQuery0 = await new TransactionRecordQuery()
	// 	.setTransactionId(contractExecRec0.transactionId)
	// 	.setIncludeChildren(true)
	// 	.execute(client);
	// console.log(
	// 	`\n- Contract call for Association (check in Hashscan): ${recQuery0.receipt.status.toString()}`
	// );

	let nft2Send = new NftId(tokenId, 2);

	// const sendTx = new TransferTransaction().addNftTransfer(nft2Send, treasuryId, aliceId).freezeWith(client);
	// const sendSign = await sendTx.sign(treasuryKey);
	// const sendSubmit = await sendSign.execute(client);
	// const sendRx = await sendSubmit.getReceipt(client);
	// console.log(`\n- Test token transfer Treasury2Alice status: ${sendRx.status}\n`);

	// STEP 4 ===================================
	console.log(`STEP 4 ===================================`);

	// Execute a contract function
	client.setOperator(treasuryId, treasuryKey);
	const contractExecTx = new ContractExecuteTransaction()
		.setContractId(contractId)
		.setGas(4000000)
		.setFunction("approveNft", new ContractFunctionParameters().addAddress(tokenAddressSol).addAddress(aliceId.toSolidityAddress()).addUint256(1))
		.freezeWith(client);
	const contractExecSign = await contractExecTx.sign(treasuryKey);
	const contractExecSubmit = await contractExecSign.execute(client);
	const contractExecRec = await contractExecSubmit.getRecord(client);

	const recQuery = await new TransactionRecordQuery().setTransactionId(contractExecRec.transactionId).setIncludeChildren(true).execute(client);
	console.log(`\n- Contract call for NFT Allowance (check in Hashscan): ${recQuery.receipt.status.toString()}`);
	//
	console.log(`- https://testnet.mirrornode.hedera.com/api/v1/accounts/${treasuryId}/nfts \n`);
	client.setOperator(operatorId, operatorKey);
	//
	await balanceCheckerFcn(treasuryId, tokenId, client);
	await balanceCheckerFcn(aliceId, tokenId, client);
	await balanceCheckerFcn(bobId, tokenId, client);
	//

	nft2Send = new NftId(tokenId, 1);
	// client.setOperator(aliceId, aliceKey);
	const approvedSendTx = new TransferTransaction()
		.addApprovedNftTransfer(nft2Send, treasuryId, bobId)
		.setTransactionId(TransactionId.generate(aliceId))
		.freezeWith(client);
	const approvedSendSign = await approvedSendTx.sign(aliceKey);
	const approvedSendSubmit = await approvedSendSign.execute(client);
	const approvedSendRx = await approvedSendSubmit.getReceipt(client);
	console.log(`\n- Allowance transfer status: ${approvedSendRx.status} \n`);

	// client.setOperator(operatorId, operatorKey);

	await balanceCheckerFcn(treasuryId, tokenId, client);
	await balanceCheckerFcn(aliceId, tokenId, client);
	await balanceCheckerFcn(bobId, tokenId, client);
	//

	console.log(`end`);

	// ========================================
	// FUNCTIONS
	async function tQueryFcn(tId) {
		let info = await new TokenInfoQuery().setTokenId(tId).execute(client);
		return info;
	}
	async function aQueryFcn(aId) {
		let info = await new AccountInfoQuery().setAccountId(aId).execute(client);
		return info;
	}

	async function bCheckerFcn(aId) {
		let balanceCheckTx = await new AccountBalanceQuery().setAccountId(aId).execute(client);
		return balanceCheckTx.hbars;
	}

	async function nftCreateMint() {
		// DEFINE CUSTOM FEE SCHEDULE
		// let nftCustomFee = await new CustomRoyaltyFee()
		// 	.setNumerator(5)
		// 	.setDenominator(10)
		// 	.setFeeCollectorAccountId(treasuryId)
		// 	.setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(200)));

		// IPFS CONTENT IDENTIFIERS FOR WHICH WE WILL CREATE NFTs
		CID = [
			"QmNPCiNA3Dsu3K5FxDPMG5Q3fZRwVTg14EXA92uqEeSRXn",
			"QmZ4dgAgt8owvnULxnKxNe8YqpavtVCXmc1Lt2XajFpJs9",
			// "QmPzY5GxevjyfMUF5vEAjtyRoigzWp47MiKAtLBduLMC1T",
			// "Qmd3kGgSrAwwSrhesYcY7K54f3qD7MDo38r7Po2dChtQx5",
			// "QmWgkKz3ozgqtnvbCLeh7EaR1H8u5Sshx3ZJzxkcrT3jbw",
		];

		// CREATE NFT WITH CUSTOM FEE
		let nftCreate = await new TokenCreateTransaction()
			.setTokenName("Fall Collection")
			.setTokenSymbol("LEAF")
			.setTokenType(TokenType.NonFungibleUnique)
			.setDecimals(0)
			.setInitialSupply(0)
			.setTreasuryAccountId(treasuryId)
			// .setSupplyType(TokenSupplyType.Finite)
			// .setMaxSupply(CID.length)
			// .setCustomFees([nftCustomFee])
			// .setAdminKey(adminKey)
			.setSupplyKey(treasuryKey)
			// .setPauseKey(pauseKey)
			// .setFreezeKey(freezeKey)
			// .setWipeKey(wipeKey)
			.freezeWith(client);

		let nftCreateTxSign = await nftCreate.sign(treasuryKey);
		let nftCreateSubmit = await nftCreateTxSign.execute(client);
		let nftCreateRx = await nftCreateSubmit.getReceipt(client);
		let tokenId = nftCreateRx.tokenId;
		console.log(`Created NFT with Token ID: ${tokenId} \n`);

		// MINT NEW BATCH OF NFTs
		nftLeaf = [];
		for (var i = 0; i < CID.length; i++) {
			nftLeaf[i] = await tokenMinterFcn(CID[i]);
			console.log(`Created NFT ${tokenId} with serial: ${nftLeaf[i].serials[0].low}`);
		}

		async function tokenMinterFcn(CID) {
			mintTx = await new TokenMintTransaction()
				.setTokenId(tokenId)
				.setMetadata([Buffer.from(CID)])
				.freezeWith(client);
			let mintTxSign = await mintTx.sign(treasuryKey);
			let mintTxSubmit = await mintTxSign.execute(client);
			let mintRx = await mintTxSubmit.getReceipt(client);
			return mintRx;
		}
		var tokenInfo = await new TokenInfoQuery().setTokenId(tokenId).execute(client);

		return [tokenId, tokenInfo];
	}

	async function accountCreateFcn(pvKey, iBal, client) {
		const response = await new AccountCreateTransaction()
			.setInitialBalance(iBal)
			.setKey(pvKey.publicKey)
			.setMaxAutomaticTokenAssociations(10)
			.execute(client);
		const receipt = await response.getReceipt(client);
		return [receipt.status, receipt.accountId];
	}

	async function balanceCheckerFcn(acId, tkId, client) {
		let balanceCheckTx = [];
		try {
			balanceCheckTx = await new AccountBalanceQuery().setAccountId(acId).execute(client);
			console.log(
				`- Balance of account ${acId}: ${balanceCheckTx.hbars.toString()} + ${balanceCheckTx.tokens._map.get(tkId.toString())} units of token ${tkId}`
			);
		} catch {
			balanceCheckTx = await new AccountBalanceQuery().setContractId(acId).execute(client);
			console.log(
				`- Balance of contract ${acId}: ${balanceCheckTx.hbars.toString()} + ${balanceCheckTx.tokens._map.get(
					tkId.toString()
				)} units of token ${tkId}`
			);
		}
	}

	async function ftCreate() {
		// CREATE FT
		const tokenCreateTx = await new TokenCreateTransaction()
			.setTokenName("hbarRocks")
			.setTokenSymbol("HROK")
			.setDecimals(0)
			.setInitialSupply(100)
			.setTreasuryAccountId(treasuryId)
			// .setAdminKey(treasuryKey)
			// .setSupplyKey(treasuryKey)
			.freezeWith(client)
			.sign(treasuryKey);
		const tokenCreateSubmit = await tokenCreateTx.execute(client);
		const tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
		const tokenId = tokenCreateRx.tokenId;

		// Token query
		const tokenInfo = await tQueryFcn(tokenId);

		return [tokenId, tokenInfo];
	}
}
main();
