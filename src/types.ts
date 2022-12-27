interface FBWebhook {
    "object": 'whatsapp_business_account' // the name of the webhook subscription
    entry: Entry[]
}

interface Entry {
    id: string // whatsapp business id
    changes: Change[]
}

// changes that triggered the webhook
interface Change {
    value: Value
    field: 'messages'
}

interface Value {
    messaging_product: 'whatsapp'
    metadata: Metadata
    contacts: Contact[]
    statuses: Status[]
    errors: FBError[]
    messages: MessageObject[]
}

interface MessageObject {
    audio: {
        id: string
        mime_type: string
    }
    button: {
        payload: object
        text: string
    }
    context: {
        forwarded: boolean
        frequently_forwarded: boolean
        from: string // whatsapp id
        id: string // message id
        referred_product: {
            catalog_id: string
            product_retailer_id: string
        }
    }
    document: {
        caption: string
        filename: string
        ha256: string // hash
        mime_type: string
        id: string
    }
    errors: FBError[]
    from: string
    id: string // use this to mark message as read
    identity: {
        acknowledged: object
        customer_identity_changed: object
        created_timestamp: string
        hash: string
    }
    image: {
        caption: string
        sha256: string
        id: string
        mime_type: string
    }
    interactive: {
        type: 'button_reply' | 'list_reply'
        id: string
        title: string
        description?: string

    }
    // see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
    order: object
    referral: object
    sticker: {
        mime_type: string
        sha256: string
        id: string
        animated: boolean
    }
    system: {
        body: string
        identity: string
        new_wa_id: string
        wa_id: string
        type: 'customer_changed_number' | 'customer_identity_changed'
        customer: string // prior whatsapp id
    }
    text: {
        body: string
    }
    timestamp: number
    type: MessageType
    video: {
        caption: string
        filename: string
        sha256: string
        id: string
        mime_type: string
    }


}

type MessageType = 'audio' | 'button' | 'document' | 'text' | 'image' | 'interactive' | 'order' | 'sticker' | 'system'| 'unknown' | 'video';

// todo: create utility types with pick<> for each message type https://www.typescriptlang.org/docs/handbook/utility-types.html

interface Status {
    conversation: Conversation
    id: string
    pricing: {
        category: CategoryType
        pricing_model: "CBP"
    }
    recipient_id: string // whatsapp id
    status: "delivered" | "read" | "sent"
    timestamp: string
}

type ConversationType = "business_initiated" | "customer_initiated" | "referral_conversion";
type CategoryType = "business_initiated" | "customer_initiated" | "referral_conversion";

interface Conversation {
    id: string
    origin: {
        type: ConversationType
    }
    expiration_timestamp: string
}

interface Contact {
    wa_id: string; // customer's whatsapp id
    profile: {
        name: string;
    }
}

interface Metadata {
    display_phone_number: string
    phone_number_id: string
}

interface FBError {
    code: string
    title: string
}

export type {
    FBWebhook,
    Entry,
    Value,
    MessageObject,
    Status,
    Metadata
}