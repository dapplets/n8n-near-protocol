import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { connect, utils } from 'near-api-js';

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

export class GetAccountBalance implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Get Account Balance',
		name: 'getAccountBalance',
		group: ['transform'],
		version: 1,
		description: 'Get Account Balance',
		defaults: {
			name: 'Get Account Balance',
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
				displayName: 'Account ID',
				name: 'accountId',
				type: 'string',
				default: '',
				placeholder: 'example.near',
			},
			{
				displayName: 'Frac Digits',
				name: 'fracDigits',
				type: 'number',
				default: 4,
				placeholder: '4',
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
		let accountId: string;
		let fracDigits: number | null;

		// Iterates over all input items and add the key "networkId" with the
		// value the parameter "networkId" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				networkId = this.getNodeParameter('networkId', itemIndex, '') as string;
				accountId = this.getNodeParameter('accountId', itemIndex, '') as string;
				fracDigits = this.getNodeParameter('fracDigits', itemIndex, 4) as number;

				item = items[itemIndex];

				const near = await connect(Networks[networkId as keyof typeof Networks]);
				const account = await near.account(accountId);
				const balance = await account.getAccountBalance();

				item.json.balance = balance;
				item.json.formatted = {
					available: utils.format.formatNearAmount(balance.available, fracDigits),
					total: utils.format.formatNearAmount(balance.total, fracDigits),
					staked: utils.format.formatNearAmount(balance.staked, fracDigits),
					stateStaked: utils.format.formatNearAmount(balance.stateStaked, fracDigits),
				};
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
