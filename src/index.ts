import { Context, APIGatewayProxyResult, APIGatewayEvent, SQSEvent, SQSBatchResponse, SQSHandler } from 'aws-lambda';
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

const eventHandlers: Record<EventTypeLiterals, any> = {
    // must return APIGatewayProxyResult
    APIGatewayProxyEvent: async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
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
    SQSEvent: async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
        return new Promise((resolve, reject) => {
            console.log('got sqs events:' + event.Records.map((record) => { JSON.stringify(record, null, 2) }).join('\n'))

            const response: SQSBatchResponse = {
                batchItemFailures: []
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
    console.log('routing event: ' + event)

    for (const eventIdentifier in eventIdentifiers) {
        console.log('event identifier: ' + eventIdentifier + ' event: ');

        const eventFunctionHandler = eventIdentifiers[eventIdentifier as EventTypeLiterals];

        console.log('event function handler: ' + eventFunctionHandler)
        if (eventFunctionHandler && eventFunctionHandler(event)) {
            console.log(eventFunctionHandler(event))
            await eventHandlers[eventIdentifier as EventTypeLiterals](event, context, params);
            return;
        } else {
            console.log('No event handler found for event:', eventIdentifier);
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