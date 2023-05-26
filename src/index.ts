import { Context, APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda';
import { markAsRead, sendInteractiveMessage, sendMessage } from './apis/whatsapp';
import { FBWebhook, MessageObject, Metadata, Status, Value } from './types';

import {constants} from './resources';
import { getCompletion } from './apis/openai';

const {config} = constants;

export const handler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);
    console.log(`Context: ${JSON.stringify(context, null, 2)}`);

    const {queryStringParameters, headers, body} = event;

    // handle challenge event
    if(queryStringParameters?.['hub.mode'] === "subscribe" &&
    queryStringParameters?.['hub.verify_token'] === config.whatsapp_verify_token &&
    !!queryStringParameters?.['hub.challenge']) {
        return {
            statusCode: 200,
            body: queryStringParameters?.['hub.challenge'],
        };
    }


    const hook: FBWebhook = JSON.parse(body || '{}');

    console.log(JSON.stringify(hook, null, 2));

    let response: Promise<APIGatewayProxyResult> | undefined = undefined;

    hook.entry.forEach(({changes}) => {
        changes.forEach(({value}) => {

            value?.statuses?.forEach((status) => {
                response = handleStatusChange(status, value.metadata);
            });

            value?.messages?.forEach(message => {
                const messageType = message.type;

                switch (messageType) {
                    case 'text':
                        response = handleTextMessage(message, value);
                        break;
                    case 'interactive':
                        response = handleInteractiveSelection(message, value);
                        break;
                    default: 
                        response = handleUnknownMessage(message, value);
                }

                // handle multiple messages setting response?
            })
        })
    });
    
    return response || { statusCode: 403, body: 'bad request'};
};


async function handleTextMessage(message: MessageObject, value: Value): Promise<APIGatewayProxyResult> {
    const phone_number_id = value.metadata.phone_number_id;
    const promises = [];
    promises.push(markAsRead(phone_number_id, message.id));
    console.log(`marked message ${message.id} as read...`)

    let to = message.from;

    // hack
    if(to === '5218117466017') {
        to = '528117466017'
    }

    // let response =  `echoing: ${message.text.body}`;
    
    // // reply
    // if(message.context) {
    //     response = `this is a reply to ${message.text.body}`;
    // }


    const response = await getCompletion(message.text.body);


    console.log('openai response: ', response)
    // ordering not guaranteed
    //promises.push(sendInteractiveMessage(phone_number_id, to, response))

    
    console.log(`sending message to ${to}`)
    
    promises.push(await sendMessage(phone_number_id, to, response));

    console.log(await Promise.all(promises))
    
    return {
        statusCode: 200,
        body: ""
    }
}

async function handleUnknownMessage(message: MessageObject, value: Value): Promise<APIGatewayProxyResult> {
    console.log('unknown message type - not implemented');
    return {
        statusCode: 200,
        body: ""
    }
}

async function handleStatusChange(status: Status, metadata: Metadata): Promise<APIGatewayProxyResult>  {
    console.log('status not implemented');
    return {
        statusCode: 200,
        body: ""
    }
}


async function handleInteractiveSelection(message: MessageObject, value: Value): Promise<APIGatewayProxyResult> {
    console.log('interactive not implemented');
    
    const phone_number_id = value.metadata.phone_number_id;

    await markAsRead(phone_number_id, message.id);
    return {
        statusCode: 200,
        body: ""
    }
}