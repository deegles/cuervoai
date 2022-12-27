import { Context, APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda';
import { markAsRead, sendInteractiveMessage, sendMessage } from './api';
import { FBWebhook, MessageObject, Metadata, Status, Value } from './types';

const verify_token = "659631c882fc11eda1eb0242ac120002";

export const handler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);
    console.log(`Context: ${JSON.stringify(context, null, 2)}`);

    const {queryStringParameters, headers, body} = event;

    // handle challenge event
    if(queryStringParameters?.['hub.mode'] === "subscribe" &&
    queryStringParameters?.['hub.verify_token'] === verify_token &&
    !!queryStringParameters?.['hub.challenge']) {
        return {
            statusCode: 200,
            body: queryStringParameters?.['hub.challenge'],
        };
    }


    const message: FBWebhook = JSON.parse(body || '{}');

    console.log(JSON.stringify(message, null, 2));

    let response: Promise<APIGatewayProxyResult> | undefined = undefined;

    message.entry.forEach(({changes}) => {
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

    let response =  `echoing: ${message.text.body}`;
    
    // reply
    if(message.context) {
        response = `this is a reply to ${message.text.body}`;
    }


    console.log(`sending message to ${to}`)

    // ordering not guaranteed
    promises.push(sendMessage(phone_number_id, to, response))
    promises.push(sendInteractiveMessage(phone_number_id, to, response))

    const results = await Promise.all(promises);

    console.log(JSON.stringify(results, null, 2));
    
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
    
    return {
        statusCode: 200,
        body: ""
    }
}