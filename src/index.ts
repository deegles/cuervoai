import { Context, APIGatewayProxyResult, APIGatewayEvent, SQSEvent, SQSBatchResponse, SQSHandler, APIGatewayProxyEvent, APIGatewayProxyStructuredResultV2, SQSRecord, SQSBatchItemFailure } from 'aws-lambda';
import { markAsRead, sendButtonMessage, sendInteractiveMessage, sendMessage } from './apis/whatsapp';
import { eventIdentifiers, EventType, EventTypeLiterals, Metadata, Status, Value, WhatsAppEvent, MessageEvent, TextMessageEvent, MessageType, isWhatsappWebhook, Change, isTextMessage, InteractiveMessageEvent, isRejectedRecord, RejectedSQSRecordError, InteractiveMessageRequest } from './types';

import { constants } from './resources';
import { getChatCompletion, getCompletion } from './apis/openai';
import { DynamoDBItem, DynamoItemDAL } from './apis/dynamo';
import { appendFile, mkdir, readFile, access } from 'fs';
import path from 'path';
import { SQS } from 'aws-sdk';
import { createHash } from 'node:crypto'
import { SendMessageBatchRequestEntry } from 'aws-sdk/clients/sqs';
// const AWSXRay = require('aws-xray-sdk');
import AWSXRay, { Segment, setSegment, TraceID, utils } from 'aws-xray-sdk';
import { ChatCompletionFunctions, CreateChatCompletionRequest, CreateChatCompletionResponse } from 'openai';
import { promisify } from 'node:util';
import { F_OK } from 'constants';
import { appendToFile, getFileJson, sha256 } from './resources/utils';


// https://github.com/aws-samples/aws-xray-sdk-node-sample/blob/master/index.js
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

AWS.config.update({ region: process.env.DEFAULT_AWS_REGION || 'us-east-2' });

const sqs = new SQS()

sqs.config.update({
    region: 'us-east-2',
});

// const sqsXray = AWSXRay.captureAWSClient(sqs);

const messages_queue_url = "https://sqs.us-east-2.amazonaws.com/653625749031/messages-queue";

const { config } = constants;

interface UserData {
    waid: string;
    tokensLeft: number;
    timesCalled: number;
    setOfStrs: string[];
    total_tokens_openai: number;
}


const eventHandlers: Record<EventTypeLiterals, any> = {
    APIGatewayEvent: async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyStructuredResultV2> => {
        const { queryStringParameters, httpMethod, body, headers } = event;

        const AWSTraceHeader = headers['X-Amzn-Trace-Id'];

        // handle challenge event
        if (httpMethod === 'GET') {
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
                }
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
        }

        if (httpMethod === 'POST' && body) {
            try {
                const parsed = JSON.parse(body);
                const statuses: Status[] = [];
                const messages: MessageEvent[] = [];

                if (isWhatsappWebhook(parsed)) {
                    parsed.entry.forEach(({ changes }) => {
                        changes.forEach(({ value }) => {
                            value?.statuses?.forEach((status) => {
                                handleStatusChange(status, value.metadata);
                            });

                            value?.messages?.forEach((message) => {
                                messages.push(message);
                            });
                        });
                    });
                }

                const chunkSizeLimit = (256 * 1024); //- (236 * messages.length); // 256 KB max minus 236 bytes per message overhead
                const chunks: MessageEvent[][] = [];
                let currentChunkSize = 0;
                let currentChunk: MessageEvent[] = [];

                console.log(`queueing ${messages.length} messages...`);

                for (const message of messages) {
                    const messageSize = Buffer.byteLength(JSON.stringify(message), 'utf8');

                    if (currentChunkSize + messageSize > chunkSizeLimit) {
                        chunks.push(currentChunk);
                        currentChunk = [];
                        currentChunkSize = 0;
                    }
                    currentChunk.push(message);
                    currentChunkSize += messageSize;
                }

                if (currentChunk.length > 0) {
                    chunks.push(currentChunk);
                }

                // TODO: handle oversampling mitigation https://github.com/aws/aws-xray-sdk-node/tree/master/packages/core#oversampling-mitigation
                const promises: Promise<any>[] = [];
                chunks.forEach((chunk) => {
                    promises.push(new Promise((resolve, reject) => {
                        sqs.config
                        sqs.sendMessageBatch({
                            QueueUrl: messages_queue_url,
                            Entries: chunk.map((message) => {
                                const MessageBody = JSON.stringify(message);
                                const messageEntry: SendMessageBatchRequestEntry = {
                                    Id: sha256(MessageBody),
                                    MessageBody,
                                    MessageSystemAttributes: {
                                        AWSTraceHeader: {
                                            DataType: 'String',
                                            StringValue: AWSTraceHeader
                                        }
                                    }
                                };

                                const messageSize = Buffer.byteLength(MessageBody, 'utf8');
                                const totalSize = Buffer.byteLength(JSON.stringify(messageEntry), 'utf8');

                                console.log(`message size: ${messageSize} bytes, overhead: ${totalSize - messageSize} bytes. trace header: ${AWSTraceHeader}`);
                                return messageEntry;
                            })
                        }, (err, data) => {
                            if (err) {
                                console.log(err);
                                reject(err);
                            } else {
                                console.log(data);
                                resolve(data);
                            }
                        });
                    }));
                });

                console.log(await Promise.allSettled(promises));

                return {
                    statusCode: 200,
                    body: 'accepted',
                    isBase64Encoded: false,
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                }

            } catch (e) {
                console.log(e);
            }
        }

        return {
            statusCode: 403,
            body: 'bad request',
            isBase64Encoded: false,
            headers: {
                'Content-Type': 'text/plain'
            }
        };
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

            Records.forEach((record) => {
                promises.push(new Promise(async (resolve, reject) => {
                    try {
                        const parsed = JSON.parse(record.body);
                        const traceId = record.messageAttributes?.traceId?.stringValue || undefined;

                        // Do something
                        const result = await routeEvent(parsed, context, { traceId });

                        resolve(result);
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
                    console.log(result.reason)
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
    WhatsAppEvent: async (event: WhatsAppEvent, context: Context, { traceId }: { traceId?: string }) => {
        console.log('whatsappevent: \n' + JSON.stringify(event, null, 2));

        const promises: Promise<any>[] = [];

        event.entry.forEach(({ changes }) => {
            changes.forEach(({ value }) => {
                value?.statuses?.forEach((status) => {
                    promises.push(handleStatusChange(status, value.metadata));
                });

                value?.messages?.forEach((message) => {
                    // const promise = ;
                    // .then((result) => {
                    //     console.log('whatsapp event result: ' + JSON.stringify(result, null, 2));
                    // })
                    // .catch((e) => {
                    //     console.log(e);
                    //     return { statusCode: 403, body: 'bad request' };
                    // });

                    promises.push(routeEvent(message as EventType, context, { value, traceId }));
                });
            });
        });

        console.log(await Promise.allSettled(promises));
    },
    TextMessage: async (message: TextMessageEvent, context: Context, params: { value: Value, traceId?: string }): Promise<void> => {
        console.log('handling text message ' + JSON.stringify(message, null, 2))

        const { traceId } = params;
        if ((Date.now() / 1000) - parseInt(message.timestamp) > (60 * 3)) {
            console.log('old message, discarding: ', JSON.stringify(message))

        }
        await handleTextMessage(message, traceId);
    },
    InteractiveMessage: async (message: InteractiveMessageEvent, lambdaContext: Context, params: { value: Value, traceId?: string }): Promise<void> => {
        console.log('handling interactive message ' + JSON.stringify(message, null, 2))

        const { traceId } = params;

        const { from, interactive, id, context, type } = message;

        const path: string[] = [constants.config.mount_root, from, 'messages', `${context?.id}.json`];

        let text = ''
        if (interactive.button_reply) {
            const { id, title } = interactive.button_reply;
            text = title;

        } else if (interactive.list_reply) {
            const { id, title } = interactive.list_reply;
            text = title;
        }

        try {
            const wam = await getFileJson<InteractiveMessageRequest>(path);
            await sendMessage(from, `selected: ${text}`)
            await markAsRead(id);
        } catch (err: any) {
            if (err.code === -2) {
                await sendMessage(from, `could not find: ${path}`)
            }
        }
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

type MessageIntentTypes = 'chat' | 'chat_end' | 'single_task_text' | 'help' | 'unknown'; // rename to one_shot_task or similar

type MessageIntentsMap = { [key in MessageIntentTypes]: { descriptions: string[] } };

// a map of intents we expect to handle and sample phrases that should trigger them
const messageIntents: MessageIntentsMap = {
    chat: { descriptions: ['a message that could be the start of a chat or part of an ongoing chat'] },
    chat_end: { descriptions: ['trying to end the chat'] },
    single_task_text: { descriptions: ['trying to complete a specific task with a given text', 'a direct question about a subject'] },
    help: { descriptions: ['trying to ask for help about the bot', 'not understanding what to do'] },
    unknown: { descriptions: ['none of the other intents'] },
}

interface MessageIntentResponse {
    intent?: MessageIntentTypes;
    language_tag?: string;
}

const messageIntentCallParams = (messageText: string): CreateChatCompletionRequest => {

    const function_name = 'identify_intent'
    const content = messageText.trim().slice(0, 400);

    return {
        "model": "gpt-3.5-turbo-0613",
        "messages": [
            {
                "role": "user",
                content
            }
        ],
        function_call: { name: function_name },
        "functions": [
            {
                name: function_name,
                "description": "Identify the intent of a message as a smart Natural Language Understanding bot.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "intent": {
                            "type": "string",
                            "description": `must be one of the following: ${Object.entries(messageIntents).map(([key, value]) => `intent '${key}':[${value.descriptions.join(',')}]`)}`
                        },
                        "language_tag": {
                            "type": "string",
                            "description": "ISO-639 language tag of the text. always include unless intent is 'unknown'."
                        }
                    }
                }
            }
        ]
    }
};


async function getMessageIntent(message: TextMessageEvent): Promise<CreateChatCompletionResponse | null> {
    const { body } = message.text;

    const params = messageIntentCallParams(body);
    console.log('calling with params: ' + JSON.stringify(params, null, 2));

    const response = await getChatCompletion([], params);

    console.log('message intent response' + JSON.stringify(response, null, 2));

    return response;
}


async function handleTextMessage(message: TextMessageEvent, traceId?: string): Promise<void> {
    try {
        const promises = [];

        const table: DynamoDBItem<Partial<UserData>> = { tableName: 'UserData', primaryKey: message.from, primaryKeyName: 'id' };
        const userData = new DynamoItemDAL<UserData>(table);

        promises.push(userData.updateItem('waid', message.from));
        promises.push(userData.incrementCounter('timesCalled'));
        //promises.push(appendToFile(`${message.from}/chat.txt`, `${message.from}: ${message.text.body}\n`))

        let to = message.from;

        // let response =  `echoing: ${message.text.body}`;

        // // reply
        // if(message.context) {
        //     response = `this is a reply to ${message.text.body}`;
        // }

        const response = await getMessageIntent(message);

        if (response && response.choices?.length > 1) {
            console.log('got more choices than expected: ' + JSON.stringify(response, null, 2));
        }

        const choice = response?.choices[0];

        // const counter = await userData.incrementCounter('total_tokens_openai', response?.usage?.total_tokens || 0) as number;

        if (choice && choice.message?.function_call?.name === 'identify_intent') {
            const args = JSON.parse(choice.message?.function_call.arguments || '{}'); // TODO: type this
            const lang = args?.language_tag || 'en'; // TODO: use configurable language

            // handle single task intent
            if (args?.intent === 'single_task_text') {
               promises.push(new Promise<void>(async (resolve, reject) => {
                    try {
                        const completion = await getChatCompletion([{
                            content: message.text.body,
                            role: 'user',
                            name: message.from
                        }]);

                        const text = completion?.choices?.map(({ message }) => message?.content).join(' ') || 'no response!';

                        await sendMessage(to, `${text} \n tokens used: ${completion?.usage?.total_tokens}`);
                        await markAsRead(message.id);
                       resolve();
                    } catch (err) {
                        console.log('err ' + err)
                       reject(err);
                    }
              }))
            }
            // handle possible chat request

            // handle help request

        }




        //console.log('openai response: ', response)

        // console.log(`sending message to ${to}`)

        // const text = response?.choices?.map(({ message }) => `${message?.content}${[message?.function_call?.name, message?.function_call?.arguments]}`).join(' ') || 'no response!';

        //promises.push(sendInteractiveMessage(to, text))
        // promises.push(sendButtonMessage(to));
        //promises.push(appendToFile(`${message.from}/chat.txt`, `openai: ${text}\n`))

        // TODO: handle response size greater than 4096 characters
        // promises.push(sendMessage(to, `${text} \n tokens used: ${response?.usage?.total_tokens}, total: ${counter}`));
        promises.push(userData.incrementCounter('timesCalled'))

        console.log(await Promise.allSettled(promises))

    } catch (e) {
        console.log(e);
        throw e;
    }
}

async function handleUnknownMessage(message: MessageEvent, value: Value): Promise<void> {
    console.log('unknown message type - not implemented');
}

async function handleStatusChange(status: Status, metadata: Metadata): Promise<void> {
    console.log('status not implemented');

}


async function handleInteractiveSelection(message: MessageEvent, value: Value): Promise<void> {
    console.log('interactive not implemented');

    const phone_number_id = value.metadata.phone_number_id;

    await markAsRead(phone_number_id, message.id);
}
