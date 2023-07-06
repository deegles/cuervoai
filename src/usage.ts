import BigNumber from 'bignumber.js';

// aws: webhooks, sqs, lambda
// whatsapp: sending message, conversation window cost
// resource: efs disk usage, 
type UsageType = 'transaction' | 'time' | 'bandwidth' | 'storage' | 'api' | 'resource'; 
type Provider = 'aws' | 'stripe' | 'openai';

type UsageRecord = {
    type: UsageType;
    label: string;
    costPerUnit: BigNumber;
    timestamp: number;
};

const gb = BigNumber(10).exponentiatedBy(9); 
const gib = BigNumber(2).exponentiatedBy(30);

const SQSCostPerMessage = BigNumber('0.40').dividedBy('1000000'); // one message is one api action  or each 64kb of a request
const SQSCostPerByteTransferred = BigNumber('.09').dividedBy(gib);


export class UsageReporter {


    // save usage report to file

    // submit to stripe

    SQSMessage(sizeInBytes: number) {
        let cost = BigNumber(0);


    }
}