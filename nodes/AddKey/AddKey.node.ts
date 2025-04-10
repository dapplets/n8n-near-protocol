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

export class AddKey implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Add Access Key',
		name: 'addKey',
		group: ['transform'],
		version: 1,
		description: 'Add Access Key',
		defaults: {
			name: 'Add Access Key',
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
				required: true,
			},
			{
				displayName: 'Private Key to Sign',
				name: 'privateKey',
				type: 'string',
				default: '',
				placeholder: 'ed25519:deadbeef',
				required: true,
			},
			{
				displayName: 'Signer Account ID',
				name: 'signerId',
				type: 'string',
				default: '',
				placeholder: 'example.near',
				required: true,
			},
			{
				displayName: 'Public Key to Add',
				name: 'publicKey',
				type: 'string',
				default: '',
				placeholder: 'ed25519:deadbeef',
				description: 'A public key to be associated with the contract',
				required: true,
			},
			{
				displayName: 'Contract Account ID',
				name: 'contractId',
				type: 'string',
				default: '',
				placeholder: 'example.near',
				description: 'NEAR account where the contract is deployed',
			},
			{
				displayName: 'Method Names as JSON',
				name: 'methodNames',
				type: 'string',
				default: '',
				placeholder: '[]',
				description:
					"The method names on the contract that should be allowed to be called. Pass null for no method names and '' or [] for any method names.",
			},
			{
				displayName: 'Attached NEAR Amount',
				name: 'amount',
				type: 'string',
				default: '',
				placeholder: '1000000000000000000000000',
				description: 'Payment in yoctoⓃ that is sent to the contract during this function call',
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
		let privateKey: string;
		let networkId: string;
		let signerId: string;
		let publicKey: string;
		let contractId: string;
		let methodNames: string;
		let amount: string;

		// Iterates over all input items and add the key "networkId" with the
		// value the parameter "networkId" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				privateKey = this.getNodeParameter('privateKey', itemIndex, '') as string;
				networkId = this.getNodeParameter('networkId', itemIndex, '') as string;
				publicKey = this.getNodeParameter('publicKey', itemIndex, '') as string;
				signerId = this.getNodeParameter('signerId', itemIndex, '') as string;
				contractId = this.getNodeParameter('contractId', itemIndex, '') as string;
				methodNames = this.getNodeParameter('methodNames', itemIndex, '')
					? (JSON.parse(this.getNodeParameter('methodNames', itemIndex, '') as string) as any)
					: undefined;
				amount = this.getNodeParameter('amount', itemIndex, '') as string;

				item = items[itemIndex];

				const keyPair = KeyPair.fromString(privateKey as KeyPairString);
				const keyStore = new InMemoryKeyStore();
				await keyStore.setKey(networkId, signerId, keyPair);
				const near = await connect({
					...Networks[networkId as keyof typeof Networks],
					keyStore,
					deps: { keyStore },
				});
				const account = await near.account(signerId);
				const result = await account.addKey(
					publicKey,
					contractId ? contractId : undefined,
					methodNames ? methodNames : undefined,
					amount ? BigInt(amount) : undefined,
				);

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
