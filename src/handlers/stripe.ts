import { UserData } from "aws-sdk/clients/ec2";
import Stripe from "stripe";
import { DynamoDBItem, DynamoItemDAL } from "../apis/dynamo";
import { sendSubscriptionActivatedTemplate } from "../apis/whatsapp";
import { StripeEvent } from "../resources/types/stripe/events"
import { GetSubscriptionActivatedRequestUS } from "../resources/types/whatsapp/requests";

export const handleStripeEvent = async (event: StripeEvent): Promise<void> => {
    console.log('handling stripe event: ' + JSON.stringify(event, null, 2))

    switch (event.type) {
        case  "invoice.created":
        case  "invoice.deleted":
        case  "invoice.finalization_failed":
        case  "invoice.finalized":
        case  "invoice.marked_uncollectible":
        case  "invoice.paid":
        case  "invoice.payment_action_required":
        case  "invoice.payment_failed":
        case  "invoice.payment_succeeded":
        case  "invoice.sent":
        case  "invoice.upcoming":
        case  "invoice.updated":
        case  "invoice.voided":
            await handleInvoiceEvent(event);
            break;
        case 'customer.subscription.created':
        case 'customer.subscription.deleted':
        case 'customer.subscription.paused':
        case 'customer.subscription.pending_update_applied':
        case 'customer.subscription.pending_update_expired':
        case 'customer.subscription.resumed':
        case 'customer.subscription.trial_will_end':
        case 'customer.subscription.updated':
            await handleSubscriptionChange(event);
            break;
        default:
            console.log('not handling event: ' + event.type);
    }
}

const handleInvoiceEvent = async ({data, type, id}: Stripe.DiscriminatedEvent.InvoiceEvent) => {
    const phone = data.object.customer_phone;

    if(phone && type === 'invoice.paid') {
        const {wa_id} = await sendSubscriptionActivatedTemplate(phone);
        console.log('notified of invoice paid subscription: ' + wa_id);
    }

    
}

const handleSubscriptionChange = async ({data, type, id}: Stripe.DiscriminatedEvent.CustomerSubscriptionEvent) => {
    
}

// approach 1:
// to verify that a subscription is active on a customers phone number 
// phone numbers are not whatsapp ids, so we have to find the mapping
// we can send a message via cloud api and the result contains the whatsapp id (input vs. wa_id): https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/
// however we cannot send a message outside of the 24-hour window if we are not opted-in https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in
// first check if we already have a wa_id mapping for this phone number
// if we do, check if we are within the 24-hour conversation window
// if we are, send the message updating the user on their subscription status
// if we do not have the mapping, send a template message(?) telling them their subscription status https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
// save the mapping
// update the subscription status in the customers wa_id folder

// approach 2
// using customer's phone number and currency choice, select language
// send template message to phone number
// use wa_id from response
// update subscription status in the customers wa_id folder

interface PhoneNumberData {
    wa_id: string
}

const notifySubscriptionChange = async (phoneNumber: string, language: string): Promise<void> => {
   

}

const getCustomerWhatsappId = async (phoneNumber: string, language: string): Promise<string | undefined> => {
    const table: DynamoDBItem<Partial<PhoneNumberData>> = { tableName: 'UserData', primaryKey: phoneNumber, primaryKeyName: 'id' };
    const data = new DynamoItemDAL<PhoneNumberData>(table);

    const wa_id = await data.getItem('wa_id');

    if(wa_id) {
        return wa_id;
    }
}