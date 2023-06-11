import { Context, APIGatewayProxyResult, APIGatewayEvent, SQSEvent, SQSBatchResponse, SQSHandler, APIGatewayProxyEvent, APIGatewayProxyStructuredResultV2, SQSRecord, SQSBatchItemFailure } from 'aws-lambda';
import { markAsRead, sendInteractiveMessage, sendMessage } from './apis/whatsapp';
import { eventIdentifiers, EventType, EventTypeLiterals, Metadata, Status, Value, WhatsAppEvent, Message, TextMessage, MessageType } from './types';

import { constants } from './resources';
import { getChatCompletion, getCompletion } from './apis/openai';
import { DynamoDBItem, DynamoItemDAL } from './apis/dynamo';

const { config } = constants;

interface UserData {
    waid: string;
    tokensLeft: number;
    timesCalled: number;
    setOfStrs: string[];
    total_tokens_openai: number;
}

interface RejectedSQSRecordError {
    error: Error;
    record: SQSRecord
}

const eventHandlers: Record<EventTypeLiterals, any> = {
    APIGatewayEvent: async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyStructuredResultV2> => {
        const { queryStringParameters } = event;

        // handle challenge event
        if (queryStringParameters?.['hub.mode'] === "subscribe" &&
            queryStringParameters?.['hub.verify_token'] === config.whatsapp_verify_token &&
            !!queryStringParameters?.['hub.challenge']) {
            return {
                statusCode: 200,
                body: queryStringParameters?.['hub.challenge'],
                isBase64Encoded: false,
                headers: {
                    'Content-Type': 'text/plain'
                }
            };
        } else {
            console.log('returning 403 \n' + JSON.stringify(event, null, 2));
            return {
                statusCode: 403,
                body: 'bad request',
                isBase64Encoded: false,
                headers: {
                    'Content-Type': 'text/plain'
                }
            };
        }
    },
    APIGatewayProxyEvent: async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
        const { queryStringParameters, headers, body } = event;

        // handle challenge event
        if (queryStringParameters?.['hub.mode'] === "subscribe" &&
            queryStringParameters?.['hub.verify_token'] === config.whatsapp_verify_token &&
            !!queryStringParameters?.['hub.challenge']) {
            return {
                statusCode: 200,
                body: queryStringParameters?.['hub.challenge'],
            };
        }

        const eventBody = JSON.parse(body || '{}');

        try {
            const result = await routeEvent(eventBody, context);
            return { statusCode: 200, body: 'handled api gateway event' };
        } catch (e) {
            console.log(e);
            return { statusCode: 403, body: 'bad request' };
        }
    },
    SQSEvent: async ({ Records }: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
        return new Promise(async (resolve, reject) => {
            const promises: Promise<any>[] = [];


            const isRejectedRecord = (input: any): input is RejectedSQSRecordError => input.status === 'rejected';

            Records.forEach((record) => {
                promises.push(new Promise(async (resolve, reject) => {
                    try {
                        const parsed = JSON.parse(record.body);
                        resolve(await routeEvent(parsed, context));
                    } catch (error) {
                        reject({
                            error,
                            record,
                        });
                    }
                }));
            });

            const results = await Promise.allSettled(promises);

            const batchItemFailures: SQSBatchItemFailure[] = (results as PromiseSettledResult<RejectedSQSRecordError>[])
                .filter((result): result is PromiseRejectedResult => isRejectedRecord(result))
                .map((result) => {
                    return {
                        itemIdentifier: (result.reason as RejectedSQSRecordError).record.messageId,
                    };
                });

            if (batchItemFailures.length > 0) {
                console.log('failed messages: ' + batchItemFailures.map((failure) => failure.itemIdentifier).join(', '));
            }

            const response: SQSBatchResponse = {
                batchItemFailures
            }

            resolve(response)
        });
    },
    WhatsAppEvent: async (event: WhatsAppEvent, context: Context) => {
        console.log('whatsappevent: \n' + JSON.stringify(event, null, 2));

        const promises: Promise<any>[] = [];

        event.entry.forEach(({ changes }) => {
            changes.forEach(({ value }) => {
                value?.statuses?.forEach((status) => {
                    handleStatusChange(status, value.metadata);
                });

                value?.messages?.forEach((message) => {
                    const promise = routeEvent(message as EventType, context, { value })
                        .then((result) => {
                            console.log('whatsapp event result: ' + JSON.stringify(result, null, 2));
                        })
                        .catch((e) => {
                            console.log(e);
                            return { statusCode: 403, body: 'bad request' };
                        });

                    promises.push(promise);
                });
            });
        });

        await Promise.all(promises);
    },
    TextMessage: async (message: TextMessage, context: Context, params: { value: Value }): Promise<void> => {
        console.log('handling text message ' + JSON.stringify(message, null, 2))

        const { value } = params;
        if ((Date.now() / 1000) - parseInt(message.timestamp) > (60 * 3)) {
            console.log('old message, discarding: ', JSON.stringify(message))

        }
        await handleTextMessage(message, value);
    },
};

export const handler = async (event: EventType, context: Context): Promise<any> => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);
    console.log(`Context: ${JSON.stringify(context, null, 2)}`);

    const result = await routeEvent(event, context);
    return result;
};


async function routeEvent(event: EventType, context: Context, params: any = {}) {
    for (const eventIdentifier in eventIdentifiers) {
        const eventFunctionHandler = eventIdentifiers[eventIdentifier as EventTypeLiterals];
        if (eventFunctionHandler && eventFunctionHandler(event)) {
            return await eventHandlers[eventIdentifier as EventTypeLiterals](event, context, params);
        }
    }

    throw new Error('No event handler found for event\n' + JSON.stringify(event, null, 2) + '\n' + JSON.stringify(context, null, 2));
}

async function handleTextMessage(message: TextMessage, value: Value): Promise<void> {
    const phone_number_id = value.metadata.phone_number_id;
    const promises = [];
    promises.push(markAsRead(phone_number_id, message.id));
    console.log(`marked message ${message.id} as read...`)

    const table: DynamoDBItem<Partial<UserData>> = { tableName: 'UserData', primaryKey: phone_number_id, primaryKeyName: 'id' };
    const userData = new DynamoItemDAL<UserData>(table);

    promises.push(userData.updateItem('waid', phone_number_id));
    promises.push(userData.incrementCounter('timesCalled'));

    let to = message.from;

    // hack
    if (to === '5218117466017') {
        to = '528117466017'
    }

    // let response =  `echoing: ${message.text.body}`;

    // // reply
    // if(message.context) {
    //     response = `this is a reply to ${message.text.body}`;
    // }

    const response = await getChatCompletion([{
        content: message.text.body,
        role: 'user',
        name: message.from
    }]);

    const counter = await userData.incrementCounter('total_tokens_openai', response?.usage?.total_tokens || 0) as number;

    console.log('openai response: ', response)
    // ordering not guaranteed
    //promises.push(sendInteractiveMessage(phone_number_id, to, response))


    console.log(`sending message to ${to}`)

    const text = response?.choices?.map(({ message }) => message?.content).join(' ') || 'no response!';

    promises.push(sendMessage(phone_number_id, to, `${text} \n tokens used: ${counter}`));
    promises.push(userData.incrementCounter('timesCalled'))

    console.log(await Promise.all(promises))
}

async function handleUnknownMessage(message: Message, value: Value): Promise<void> {
    console.log('unknown message type - not implemented');
}

async function handleStatusChange(status: Status, metadata: Metadata): Promise<void> {
    console.log('status not implemented');

}


async function handleInteractiveSelection(message: Message, value: Value): Promise<void> {
    console.log('interactive not implemented');

    const phone_number_id = value.metadata.phone_number_id;

    await markAsRead(phone_number_id, message.id);
}