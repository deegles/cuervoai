/// <reference types="stripe-event-types" />
import Stripe from 'stripe';
import { constants } from '../..';

export type StripeEvent = Stripe.DiscriminatedEvent;

export interface StripeEventEnvelope {
    event: string;
    signature: string;
}

// https://stripe.com/docs/api/events/types
export function isStripeEvent(event: any): event is StripeEvent {
    return event?.api_version === constants.config.stripe_api_version && event?.type?.split('.').length === 2; // events are always of shape resource.event
}

export function isStripeEventEnvelope(event: any): event is StripeEventEnvelope {
    try {
        return event?.signature && isStripeEvent(JSON.parse(event?.event));
    } catch(err) {
        return false;
    }
}