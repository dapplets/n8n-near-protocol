import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { KeyPair, connect } from 'near-api-js';
import { InMemoryKeyStore } from 'near-api-js/lib/key_stores';
import { KeyPairString } from 'near-api-js/lib/utils';

const Networks = {
	testnet: {
		networkId: 'testnet',
		nodeUrl: 'https://rpc.testnet.near.org',
		walletUrl: 'https://wallet.testnet.near.org',
		helperUrl: 'https://helper.testnet.near.org',
	},
	mainnet: {
		networkId: 'mainnet',
		nodeUrl: 'https://rpc.mainnet.near.org',
		walletUrl: 'https://wallet.mainnet.near.org',
		helperUrl: 'https://helper.mainnet.near.org',
	},
};

export class Transfer implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Transfer NEAR',
		name: 'transfer',
		group: ['transform'],
		version: 1,
		description: 'Transfer NEAR native tokens to another account',
		defaults: {
			name: 'Transfer NEAR',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			// Node properties which the user gets displayed and
			// can change on the node.
			{
				displayName: 'Network ID',
				name: 'networkId',
				type: 'string',
				default: 'mainnet',
				placeholder: 'mainnet',
			},
			{
				displayName: 'Private Key',
				name: 'privateKey',
				type: 'string',
				default: '',
				placeholder: 'ed25519:deadbeef',
			},
			{
				displayName: 'Sender Account ID',
				name: 'senderId',
				type: 'string',
				default: '',
				placeholder: 'example.near',
			},
			{
				displayName: 'Recipient Account ID',
				name: 'recipientId',
				type: 'string',
				default: '',
				placeholder: 'example.near',
			},
			{
				displayName: 'Amount in yoctoNEAR',
				name: 'amount',
				type: 'string',
				default: '',
				placeholder: '1000000000000000000000000',
			},
		],
	};

	// The function below is responsible for actually doing whatever this node
	// is supposed to do. In this case, we're just appending the `networkId` property
	// with whatever the user has entered.
	// You can make async calls and use `await`.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;
		let networkId: string;
		let privateKey: string;
		let senderId: string;
		let recipientId: string;
		let amount: string;

		// Iterates over all input items and add the key "networkId" with the
		// value the parameter "networkId" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				networkId = this.getNodeParameter('networkId', itemIndex, '') as string;
				privateKey = this.getNodeParameter('privateKey', itemIndex, '') as string;
				senderId = this.getNodeParameter('senderId', itemIndex, '') as string;
				recipientId = this.getNodeParameter('recipientId', itemIndex, '') as string;
				amount = this.getNodeParameter('amount', itemIndex, '') as string;

				item = items[itemIndex];

				const keyPair = KeyPair.fromString(privateKey as KeyPairString);
				const keyStore = new InMemoryKeyStore();
				await keyStore.setKey(networkId, senderId, keyPair);
				const near = await connect({
					...Networks[networkId as keyof typeof Networks],
					keyStore,
					deps: { keyStore },
				});
				const account = await near.account(senderId);
				const result = await account.sendMoney(recipientId, BigInt(amount));
				
				item.json.result = result;
			} catch (error) {
				// This node should never fail but we want to showcase how
				// to handle errors.
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					// Adding `itemIndex` allows other workflows to handle this error
					if (error.context) {
						// If the error thrown already contains the context property,
						// only append the itemIndex
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [items];
	}
}
