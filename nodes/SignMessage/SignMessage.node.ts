import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { KeyPair, utils } from 'near-api-js';
import { KeyPairString } from 'near-api-js/lib/utils';

export class SignMessage implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Sign Message',
		name: 'signMessage',
		group: ['transform'],
		version: 1,
		description: 'Sign Message',
		defaults: {
			name: 'Sign Message',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Private Key to Sign',
				name: 'privateKey',
				type: 'string',
				default: '',
				placeholder: 'ed25519:deadbeef',
				required: true,
			},
			{
				displayName: 'Message to Sign',
				name: 'message',
				type: 'string',
				default: '',
				placeholder: 'Hello from n8n',
				required: true,
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
		let message: string;

		// Iterates over all input items and add the key "networkId" with the
		// value the parameter "networkId" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				privateKey = this.getNodeParameter('privateKey', itemIndex, '') as string;
				message = this.getNodeParameter('message', itemIndex, '') as string;

				item = items[itemIndex];

				const keyPair = KeyPair.fromString(privateKey as KeyPairString);

				const arr = Uint8Array.from(Array.from(message).map((letter) => letter.charCodeAt(0)));
				const { signature, publicKey } = keyPair.sign(arr);

				item.json.signature = utils.serialize.base_encode(signature);
				item.json.publicKey = publicKey.toString();
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
