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

export class WriteContractCall implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Write Contract Call',
		name: 'writeContractCall',
		group: ['transform'],
		version: 1,
		description: 'Sends a write contract request to NEAR Protocol',
		defaults: {
			name: 'Write Contract Call',
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
				displayName: 'Signer Account ID',
				name: 'accountId',
				type: 'string',
				default: '',
				placeholder: 'example.near',
			},
			{
				displayName: 'Contract Account ID',
				name: 'contractId',
				type: 'string',
				default: '',
				placeholder: 'example.near',
			},
			{
				displayName: 'Method Name',
				name: 'methodName',
				type: 'string',
				default: '',
				placeholder: 'set_value_by_key',
			},
			{
				displayName: 'Arguments JSON',
				name: 'methodArgs',
				type: 'string',
				default: '{}',
				placeholder: '{"key": "value"}',
			},
			{
				displayName: 'Attached Deposit (in yoctoNEAR)',
				name: 'attachedDeposit',
				type: 'string',
				default: '0',
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
		let accountId: string;
		let contractId: string;
		let methodName: string;
		let methodArgs: any;
		let attachedDeposit: string;

		// Iterates over all input items and add the key "networkId" with the
		// value the parameter "networkId" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				networkId = this.getNodeParameter('networkId', itemIndex, '') as string;
				privateKey = this.getNodeParameter('privateKey', itemIndex, '') as string;
				accountId = this.getNodeParameter('accountId', itemIndex, '') as string;
				contractId = this.getNodeParameter('contractId', itemIndex, '') as string;
				methodName = this.getNodeParameter('methodName', itemIndex, '') as string;
				methodArgs = JSON.parse(
					this.getNodeParameter('methodArgs', itemIndex, '') as string,
				) as any;
				attachedDeposit = this.getNodeParameter('attachedDeposit', itemIndex, '') as string;

				item = items[itemIndex];

				const keyPair = KeyPair.fromString(privateKey as KeyPairString);
				const keyStore = new InMemoryKeyStore();
				await keyStore.setKey(networkId, accountId, keyPair);
				const near = await connect({
					...Networks[networkId as keyof typeof Networks],
					keyStore,
					deps: { keyStore },
				});
				const account = await near.account(accountId);
				const result = await account.functionCall({
					contractId,
					methodName,
					args: methodArgs,
					attachedDeposit: BigInt(attachedDeposit),
				});

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
