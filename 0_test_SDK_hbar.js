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
	const bytecode = fs.readFileSync("./0_test_sol_hbar2Contract.bin");

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

	// STEP 3 ===================================
	console.log(`STEP 3 ===================================`);

	const tokenAssociateTx = new TokenAssociateTransaction()
		.setTokenIds([tokenId])
		.setAccountId(aliceId)
		.freezeWith(client);
	const tokenAssociateSign = await tokenAssociateTx.sign(aliceKey);
	const tokenAssociateSubmit = await tokenAssociateSign.execute(client);
	const tokenAssociateRx = await tokenAssociateSubmit.getReceipt(client);
	console.log(`- Alice associated with token: ${tokenAssociateRx.status}`);

	// STEP 4 ===================================
	console.log(`STEP 4 ===================================`);

	const allowanceTx = new AccountAllowanceApproveTransaction()
		.approveHbarAllowance(treasuryId, aliceId, new Hbar(50))
		.freezeWith(client);
	const allowanceSign = await allowanceTx.sign(treasuryKey);
	const allowanceSubmit = await allowanceSign.execute(client);
	const allowanceRx = await allowanceSubmit.getReceipt(client);
	console.log(`- Allowance approved: ${allowanceRx.status}`);
	console.log(
		`\n https://testnet.mirrornode.hedera.com/api/v1/accounts/${treasuryId}/allowances/crypto`
	);

	//
	await balanceCheckerFcn(treasuryId, tokenId, client);
	await balanceCheckerFcn(aliceId, tokenId, client);
	await balanceCheckerFcn(bobId, tokenId, client);
	//
	// client.setOperator(aliceId, aliceyKey);
	const approvedSendTx = new TransferTransaction()
		.addApprovedHbarTransfer(treasuryId, -8)
		.addHbarTransfer(bobId, 8)
		.setTransactionId(TransactionId.generate(aliceId))
		.freezeWith(client);
	const approvedSendSign = await approvedSendTx.sign(aliceKey);
	const approvedSendSubmit = await approvedSendSign.execute(client);
	const approvedSendRx = await approvedSendSubmit.getReceipt(client);
	console.log(`\n- Allowance transfer status: ${approvedSendRx.status}\n`);

	await balanceCheckerFcn(treasuryId, tokenId, client);
	await balanceCheckerFcn(aliceId, tokenId, client);
	await balanceCheckerFcn(bobId, tokenId, client);
	//

	const allowanceDelTx = new AccountAllowanceApproveTransaction()
		.approveHbarAllowance(treasuryId, aliceId, new Hbar(0))
		.freezeWith(client);
	const allowanceDelSign = await allowanceDelTx.sign(treasuryKey);
	const allowanceDelSubmit = await allowanceDelSign.execute(client);
	const allowanceDelRx = await allowanceDelSubmit.getReceipt(client);
	console.log(`\n- Allowance deleted: ${allowanceDelRx.status}\n`);
	console.log(
		`\n https://testnet.mirrornode.hedera.com/api/v1/accounts/${treasuryId}/allowances/crypto`
	);

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

	async function nftStuff() {
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
				`- Balance of account ${acId}: ${balanceCheckTx.hbars.toString()} + ${balanceCheckTx.tokens._map.get(
					tkId.toString()
				)} units of token ${tkId}`
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
}
main();
