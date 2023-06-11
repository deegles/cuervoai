import { APIGatewayEvent, APIGatewayProxyEvent, SQSEvent } from "aws-lambda";

// Main WhatsApp event
export interface WhatsAppEvent {
    object: 'whatsapp_business_account';
    entry: Entry[];
}

export interface Entry {
    id: string;
    changes: Change[];
}

export interface Change {
    value: Value;
    field: "messages";
}

export interface Value {
    messaging_product: "whatsapp";
    metadata: Metadata;
    contacts: Contact[];
    errors: Error[];
    messages: Message[];
    statuses: Status[];
}

export interface Metadata {
    display_phone_number: string;
    phone_number_id: string;
}

export interface Contact {
    wa_id: string;
    profile: Profile;
}

export interface Profile {
    name: string;
}

export interface Error {
    code: number;
    title: string;
    message?: string;
    error_data?: ErrorData;
}

export interface ErrorData {
    details: string;
}

// system is for customer number change messages
export type MessageTypeField =
    'audio' |
    'button' |
    'document' |
    'text' |
    'image' |
    'interactive' |
    'order' |
    'sticker' |
    'system' |
    'unknown' |
    'video';

export interface Message {
    type: MessageTypeField;
    audio?: Audio;
    button?: Button;
    context?: Context;
    document?: Document;
    from: string;
    to: string;
    timestamp: string;
    id: string;
}

export type MessageType = TextMessage | InteractiveMessage | AudioMessage;

export interface TextMessage extends Message {
    "text": {
        "body": string;
    };
    "type": "text"
}

export interface InteractiveMessage extends Message {
    type: 'interactive'
    // Sent when a customer clicks a button.
    'button_reply':
    {
        'id': string; // Unique ID of a button.
        'title': string; // Title of a button.
        // sent when a customer selects an item from a list. 
        'list_reply':
        {
            'id': string;// Unique ID of the selected list item.
            'title': string;// Title of the selected list item.
            'description': string; // Description of the selected row.
        }
    }
}

export interface AudioMessage extends Message {
    type: 'audio'
    id: string; // ID for the audio file.
    mime_type: string; // Mime type of the audio file.
}

export interface Audio {
    id: string;
    mime_type: string;
}

export interface Button {
    payload: string;
    text: string;
}

export interface Context {
    forwarded: boolean;
    frequently_forwarded: boolean;
    from: string;
    id: string;
    referred_product?: ReferredProduct;
}

export interface ReferredProduct {
    catalog_id: string;
    product_retailer_id: string;
}

export interface Document {
    caption: string;
    filename: string;
    sha256: string;
    mime_type: string;
    id: string;
}

export interface Status {
    id: string;
    recipient_id: string;
    status: string;
    timestamp: string;
}

// EventType Definitions
// Be sure to add to both the EventTypeLiterals and EventIdentifiers types
export type EventTypeLiterals = 'WhatsAppEvent' | 'SQSEvent' | 'APIGatewayProxyEvent' | 'TextMessage';
export type EventType = WhatsAppEvent | SQSEvent | APIGatewayProxyEvent | TextMessage;

export type EventIdentifierFn<T extends EventType> = (event: any) => event is T;

export type EventIdentifiers = {
    [K in EventTypeLiterals]: EventIdentifierFn<EventType>;
};

export const eventIdentifiers: EventIdentifiers = {
    WhatsAppEvent: isWhatsappWebhook,
    SQSEvent: isSQSEvent,
    APIGatewayProxyEvent: isAPIGatewayEvent,
    TextMessage: isTextMessage,
};

export function isWhatsappWebhook(event: any): event is WhatsAppEvent {
    return event?.object === 'whatsapp_business_account' && Array.isArray(event?.entry);
}

export function isSQSEvent(event: any): event is SQSEvent {
    return event?.Records && Array.isArray(event?.Records);
}

export function isAPIGatewayEvent(event: any): event is APIGatewayProxyEvent {
    return event?.version === "2.0" && event?.routeKey && event?.requestContext?.http?.method;
}

export type MessageIdentifierFn = (message: Message) => message is MessageType;


export function isTextMessage(message: Message): message is TextMessage {
    return message.type === 'text';
}

export function isInteractiveMessage(message: Message): message is InteractiveMessage {
    return message.type === 'interactive';
}

export function isAudioMessage(message: Message): message is AudioMessage {
    return message.type === 'audio';
}


