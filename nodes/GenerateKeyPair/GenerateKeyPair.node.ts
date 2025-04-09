import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { KeyPair } from 'near-api-js';

export class GenerateKeyPair implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Generate Key Pair',
		name: 'generateKeyPair',
		group: ['transform'],
		version: 1,
		description: 'Generates a key pair',
		defaults: {
			name: 'Generate Key Pair',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [],
	};

	// The function below is responsible for actually doing whatever this node
	// is supposed to do. In this case, we're just appending the `networkId` property
	// with whatever the user has entered.
	// You can make async calls and use `await`.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;

		// Iterates over all input items and add the key "networkId" with the
		// value the parameter "networkId" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				item = items[itemIndex];

				const keyPair = KeyPair.fromRandom('ed25519');

				item.json.publicKey = keyPair.getPublicKey().toString();
				item.json.privateKey = keyPair.toString();
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
