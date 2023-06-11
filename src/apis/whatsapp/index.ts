import { constants } from "../../resources";
import fetch from "node-fetch";

const {api_keys} = constants;

const markAsReadOptions = (message_id: string) => ({
     method: 'POST',
    headers: {
        'Authorization' : `Bearer ${api_keys.whatsapp}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        "messaging_product": "whatsapp",
        "status": "read",
        message_id
    })
})

const markAsRead: (phone_number_id: string, message_id: string) => Promise<boolean> = async (phone_number_id: string, message_id: string) => {
    return new Promise(async (resolve, reject) => {
      try{const url = `https://graph.facebook.com/v17.0/${phone_number_id}/messages`
      const result = await (await fetch(url, markAsReadOptions(message_id))).json();
      console.log(result);
      resolve( !!(result as unknown as any)?.success)

      }catch(e){
        console.log(e);
        reject(false)
      }
    });
}

const addReactionOptions = (message_id: string, to: string, emoji: string = "\uD83D\uDE00") => ({
   method: 'POST',
  headers: {
      'Authorization' : `Bearer ${api_keys.whatsapp}`,
      'Content-Type': 'application/json'
  },
  body: JSON.stringify({
      "messaging_product": "whatsapp",
      "recipient_type": "individual",
      to,
      "type": "reaction",
      "reaction": {
        message_id,
        emoji
      }
  })
})

const addReaction = async (from_phone_number_id: string, to_phone_number_id: string, message_id: string, emoji: string): Promise<boolean> => {
  const url = `https://graph.facebook.com/v17.0/${from_phone_number_id}/messages`
  const result = await (await fetch(url, addReactionOptions(message_id, to_phone_number_id))).json();
  console.log(result);
  return !!(result as unknown as any)?.success
}

// todo: delete reaction based on response message id? https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/#reaction-messages

const sendMessageOptions = (to: string, message: string) => ({
     method: 'POST',
    headers: {
        'Authorization' : `Bearer ${api_keys.whatsapp}`,
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
    const url = `https://graph.facebook.com/v17.0/${phone_number_id}/messages`
    
    const result = await (await fetch(url, sendMessageOptions(to, message))).json();
    console.log(result);
    return (result as unknown as any)?.messages?.length > 0
}

const sendInteractiveMessageOptions = (to: string, message: string) => ({
     method: 'POST',
    headers: {
        'Authorization' : `Bearer ${api_keys.whatsapp}`,
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
    const url = `https://graph.facebook.com/v17.0/${phone_number_id}/messages`
    
    const result = await (await fetch(url, sendInteractiveMessageOptions(to, message))).json();
    console.log(result);
    return (result as unknown as any)?.messages?.length > 0
}


export {
    addReaction,
    markAsRead,
    sendMessage,
    sendInteractiveMessage
}

// message
// check for keywords?
// check message type (text, voice note, image)
// save message id
// reply with options for message
// save message id + reply id
// if reply is valid option
// call openai api
// respond with text
// save reply id


/**
 * other todos:
 * logging
 * metrics for api calls
 * data layer
 * - save tokens used + type for cost
 * - formula for Points or Credits used
 * - keep track per user
 * - message and reply chains
 * stripe integration
 * - handle invoice paid webhook
 * - set credits on phone number
 * - handle uploading usage metrics
 * - handle other webhooks
 * openai
 * - get token
 * - set up client
 * devops
 * - save env vars and secrets
 * - staging env?
 * - set up sqs queue
 * - set up mapping templates for webhook challenges
 * - set up url endpoint (api.yourbit.network/webhook)
 * marketing
 * - instagram
 * - settle on name
 * - settle on free tier behavior
 * ux
 * - settle on mvp flows
 * - settle on payment flow
 * other
 * - fb business verification
 * - associate new phone number
 * - set up cost monitoring in case of too much free tier usage?
 * get mx phone number
 * - set up payment on it
 */