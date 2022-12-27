const access_token = 'EAAJeYsHUU68BAJ52C6ZCANKcw0lkFtsJYlScpZC52ec8eKAcf7PpkykSd9dlQQHREZCUm9sRi07UqKTCmprtlV2C36foZC6AoKPU6ZCnQcWgY0RE0e7LmI52qoiN9z3Tdy4fORZAstDDhsZBT8Ui5go9wZCe4gN5LHgbWU2GgGA9QktZCBjw6CAJ8WKXgkAMutfXpnch4UHnYOYgQnPZBGAxdT';

import fetch from "node-fetch";
import { MessageObject } from "./types";

const markAsReadOptions: (message_id: string) => RequestInit = (message_id: string) => ({
     method: 'POST',
    headers: {
        'Authorization' : `Bearer ${access_token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        "messaging_product": "whatsapp",
        "status": "read",
        message_id
    })
})

const markAsRead: (phone_number_id: string, message_id: string) => Promise<boolean> = async (phone_number_id: string, message_id: string) => {
    const url = `https://graph.facebook.com/v15.0/${phone_number_id}/messages`
    const result = await (await fetch(url, markAsReadOptions(message_id))).json();
    console.log(result);
    return !!(result as unknown as any)?.success
}


const sendMessageOptions: (to: string, message: string) => RequestInit = (to: string, message: string) => ({
     method: 'POST',
    headers: {
        'Authorization' : `Bearer ${access_token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        to,
        "type": "text",
        "text": {
          "preview_url": false,
          "body": message
          }
      })
})

const sendMessage: (phone_number_id: string, to: string, message: string) => Promise<boolean> = async (phone_number_id: string, to: string, message: string) => {
    const url = `https://graph.facebook.com/v15.0/${phone_number_id}/messages`
    
    const result = await (await fetch(url, sendMessageOptions(to, message))).json();
    console.log(result);
    return (result as unknown as any)?.messages?.length > 0
}

const sendInteractiveMessageOptions: (to: string, message: string) => RequestInit = (to: string, message: string) => ({
     method: 'POST',
    headers: {
        'Authorization' : `Bearer ${access_token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        to,
        "type": "interactive",
  "interactive": {
    "type": "list",
    "header": {
      "type": "text",
      "text": "HEADER_TEXT"
    },
    "body": {
      "text": message
    },
    "footer": {
      "text": "FOOTER_TEXT"
    },
    "action": {
      "button": "BUTTON_TEXT",
      "sections": [
        {
          "title": "SECTION_1_TITLE",
          "rows": [
            {
              "id": "SECTION_1_ROW_1_ID",
              "title": "SECTION_1_ROW_1_TITLE",
              "description": "SECTION_1_ROW_1_DESCRIPTION"
            },
            {
              "id": "SECTION_1_ROW_2_ID",
              "title": "SECTION_1_ROW_2_TITLE",
              "description": "SECTION_1_ROW_2_DESCRIPTION"
            }
          ]
        },
        {
          "title": "SECTION_2_TITLE",
          "rows": [
            {
              "id": "SECTION_2_ROW_1_ID",
              "title": "SECTION_2_ROW_1_TITLE",
              "description": "SECTION_2_ROW_1_DESCRIPTION"
            },
            {
              "id": "SECTION_2_ROW_2_ID",
              "title": "SECTION_2_ROW_2_TITLE",
              "description": "SECTION_2_ROW_2_DESCRIPTION"
            }
          ]
        }
      ]
    }
  }}
)});

const sendInteractiveMessage: (phone_number_id: string, to: string, message: string) => Promise<boolean> = async (phone_number_id: string, to: string, message: string) => {
    const url = `https://graph.facebook.com/v15.0/${phone_number_id}/messages`
    
    const result = await (await fetch(url, sendInteractiveMessageOptions(to, message))).json();
    console.log(result);
    return (result as unknown as any)?.messages?.length > 0
}


export {
    markAsRead,
    sendMessage,
    sendInteractiveMessage
}