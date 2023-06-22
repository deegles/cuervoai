import { APIGatewayEvent, APIGatewayProxyEvent, SQSEvent, SQSRecord } from "aws-lambda";

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
    messages: MessageEvent[];
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

export interface MessageEvent {
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

export type MessageType = TextMessageEvent | InteractiveMessageEvent | AudioMessageEvent;

export interface TextMessageEvent extends MessageEvent {
    "text": {
        "body": string;
    };
    "type": "text"
}

export type InteractiveEventSubType = 'button_reply' | 'list_reply';

export interface InteractiveMessageEvent extends MessageEvent {
    type: 'interactive';
    interactive: {
        [key in InteractiveEventSubType]: InteractiveListRow
    }
}

export interface InteractiveMessageSelection {

}

// interactive message selection
// {
//     "context": {
//         "from": "19388888871",
//         "id": "wamid.HBgLMTUxMjgyNjQ2MjQVAgARGBIwMDBEMENGRjZFNjZBNzQwMzYA"
//     },
//     "from": "15128264624",
//     "id": "wamid.HBgLMTUxMjgyNjQ2MjQVAgASGBYzRUIwNzQ3RUNBRTEwM0Q0QTcxOTJBAA==",
//     "timestamp": "1687019798",
//     "type": "interactive",
//     "interactive": {
//         "type": "list_reply",
//         "list_reply": {
//             "id": "SECTION_2_ROW_2_ID",
//             "title": "SECTION_2_ROW_2_TITLE",
//             "description": "SECTION_2_ROW_2_DESCRIPTION"
//         }
//     }
// }

// interactive message request
// "messaging_product": "whatsapp",
// "recipient_type": "individual",
// to,
// "type": "interactive",
// "interactive": {
//   "type": "list",
//   "header": {
//     "type": "text",
//     "text": "HEADER_TEXT"
//   },
//   "body": {
//     "text": message
//   },
//   "footer": {
//     "text": "FOOTER_TEXT"
//   },
//   "action": {
//     "button": "BUTTON_TEXT",
//     "sections": [
//       {
//         "title": "SECTION_1_TITLE",
//         "rows": [
//           {
//             "id": "SECTION_1_ROW_1_ID",
//             "title": "SECTION_1_ROW_1_TITLE",
//             "description": "SECTION_1_ROW_1_DESCRIPTION"
//           },
//           {
//             "id": "SECTION_1_ROW_2_ID",
//             "title": "SECTION_1_ROW_2_TITLE",
//             "description": "SECTION_1_ROW_2_DESCRIPTION"
//           }
//         ]
//       },
//     ]
//   }
// }
// }



// for requests to whatsapp messaging endpoint
// {
//   "messaging_product": "whatsapp"
//   "recipient_type": "individual",
//   "to": "<TO>",
//   "type": "<TYPE>",

interface MessageRequest {
    "messaging_product": "whatsapp",
    "recipient_type": 'individual';
    "to": string;
}

//   /* TEXT MESSAGES ONLY */
//   "text": {<TEXT>}
interface TextMessageRequest extends MessageRequest {
    type: 'text';
    text: {
        "preview_url": boolean;
        // if preview_url is true, body must include a url
        "body": string;
    }
}

//   /* REACTION MESSAGES ONLY */
//   "reaction": {<REACTION>}
interface ReactionMessageRequest extends MessageRequest {
    type: 'reaction';
    reaction: {
        "message_id": string;
        "emoji": string;
    }
}

//   /* MEDIA MESSAGES ONLY. FOR EXAMPLE, FOR IMAGE MEDIA: */
//   "image": {<IMAGE>}
type MediaType = 'audio' | 'document' | 'image' | 'sticker' | 'video';
type MediaLinkType = 'id' | 'link';

type MediaProperties = {
    [Key in MediaType]?: Record<MediaLinkType, string>;
  };

interface MediaMessageRequest extends MessageRequest, MediaProperties {
    type: MediaType;
}

//   /* LOCATION MESSAGES ONLY */
//   "location": {<LOCATION>}
interface LocationMessageRequest extends MessageRequest {
    type: 'location'
    location: {
        "longitude": number;
        "latitude": number;
        "name": string;
        "address": string;
    }
}
//   /* CONTACTS MESSAGES ONLY */
//   "contacts": {<CONTACTS>}
// TODO

//   /* INTERACTIVE MESSAGES ONLY */
//   "interactive": {<INTERACTIVE>}
// }
export type InteractiveMessageType = 'id' | 'link';

export interface ButtonReply {
    "type": "reply";
    "reply": {
        "id": string;
        "title": string;
    }
}
export interface InteractiveButton {
    "type": "button";
    "body": {
        "text": string;
    };
    "action": {
        "buttons": ButtonReply[]
    }
}

export interface InteractiveListRow {
    id: string;
    title: string;
    description?: string;
}

export interface InteractiveListSection {
    "title": string;
    "rows": InteractiveListRow[]
}

export interface InteractiveList {
    type: 'list'
    "header": {
        "type": string;
        "text": string;
    };
    "body": {
        "text": string;
    },
    "footer": {
        "text": string;
    },
    "action": {
        "button": string;
        "sections": InteractiveListSection[]
    }

}

export interface InteractiveMessageRequest extends MessageRequest {
    type: 'interactive'
    interactive: InteractiveButton | InteractiveList
}

export interface AudioMessageEvent extends MessageEvent {
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
export type EventTypeLiterals = 'WhatsAppEvent' | 'SQSEvent' | 'APIGatewayProxyEvent' | 'APIGatewayEvent' | 'TextMessage' | 'InteractiveMessage';
export type EventType = WhatsAppEvent | SQSEvent | APIGatewayProxyEvent | APIGatewayEvent | TextMessageEvent | InteractiveMessageEvent;

export type EventIdentifierFn<T extends EventType> = (event: any) => event is T;

export type EventIdentifiers = {
    [K in EventTypeLiterals]: EventIdentifierFn<EventType>;
};

export const eventIdentifiers: EventIdentifiers = {
    WhatsAppEvent: isWhatsappWebhook,
    SQSEvent: isSQSEvent,
    APIGatewayProxyEvent: isAPIGatewayProxyEvent,
    TextMessage: isTextMessage,
    APIGatewayEvent: isAPIGatewayEvent,
    InteractiveMessage: isInteractiveMessage,
};

export function isWhatsappWebhook(event: any): event is WhatsAppEvent {
    return event?.object === 'whatsapp_business_account' && Array.isArray(event?.entry);
}

export function isSQSEvent(event: any): event is SQSEvent {
    return event?.Records && Array.isArray(event?.Records);
}

export function isAPIGatewayProxyEvent(event: any): event is APIGatewayProxyEvent {
    return event?.version === "2.0" && event?.routeKey && event?.requestContext?.http?.method;
}

export function isAPIGatewayEvent(event: any): event is APIGatewayEvent {
    return event?.resource === "/webhooks" && event?.requestContext.stage
}

export type MessageIdentifierFn = (message: MessageEvent) => message is MessageType;


export function isTextMessage(message: MessageEvent): message is TextMessageEvent {
    return message.type === 'text';
}

export function isInteractiveMessage(message: MessageEvent): message is InteractiveMessageEvent {
    return message.type === 'interactive';
}

// export function isInteractiveListMessage(message: MessageEvent) message is InteractiveListMessage {

// }

export function isAudioMessage(message: MessageEvent): message is AudioMessageEvent {
    return message.type === 'audio';
}


export interface RejectedSQSRecordError {
    error: Error;
    record: SQSRecord
}

export function isRejectedRecord(input: any): input is RejectedSQSRecordError { return input.status === 'rejected' };

