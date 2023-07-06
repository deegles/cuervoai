

/**
 * 
 * curl -X  POST \
 'https://graph.facebook.com/v17.0/FROM_PHONE_NUMBER_ID/messages' \
 -H 'Authorization: Bearer ACCESS_TOKEN' \
 -H 'Content-Type: application/json' \
 -d '{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "PHONE_NUMBER",
  "type": "template",
  "template": {
    "name": "TEMPLATE_NAME",
    "language": {
      "code": "LANGUAGE_AND_LOCALE_CODE"
    },
    "components": [
      {
        "type": "body",
        "parameters": MessageTemplateParameter[]
      }
    ]
  }
}'
 */

export interface MessageTemplateTextParameter {
    type: 'text';
    text: string;
}

export interface MessageTemplateCurrencyParameter {
    type: 'currency';
    currency: {
        fallback_value: string;
        code: 'USD' | 'MXN';
        amount_1000: number;
    }
}

export interface MessageTemplateDateTimeParameter {
    type: 'date_time';
    date_time: {
        fallback_value: string; // DATE
    }
}

export type MessageTemplateParameter = MessageTemplateTextParameter | MessageTemplateCurrencyParameter | MessageTemplateDateTimeParameter;

export interface MessageTemplateComponent {
    type: 'body';
    parameters: MessageTemplateParameter[]
}

export type MessageTemplateLanguageCode = 'en_US' | 'es_MX';

export interface MessageTemplateData {
    name: string;
    language: {
        code: MessageTemplateLanguageCode
    }
    components: MessageTemplateComponent[]
}

export interface MessageTemplateRequest {
    messaging_product: 'whatsapp';
    recipient_type: 'individual';
    to: string;
    type: 'template';
    template: MessageTemplateData
}

class SubscriptionActivatedTemplate implements MessageTemplateRequest {
    messaging_product = 'whatsapp' as const;
    recipient_type = "individual" as const;
    to: string;
    type = "template" as const;
    template: MessageTemplateData;

    constructor(to: string, code: MessageTemplateLanguageCode, monthly_price: number, per_credit_price: number, credit_threshold: number) {
        this.messaging_product = 'whatsapp' as const;
        this.to = to;

        this.template = {
            name: 'subscription_activated',
            language: {
                code
            },
            components: [
                {
                    type: "body",
                    parameters: [
                        {
                            type: 'currency',
                            currency: {
                                fallback_value: `${Math.trunc(monthly_price * 1000)}`,
                                code: code === 'en_US' ? 'USD' : 'MXN',
                                amount_1000: Math.trunc(monthly_price * 1000)
                            },
                        },
                        {
                            type: 'currency',
                            currency: {
                                fallback_value: `${Math.trunc(per_credit_price * 1000)}`,
                                code: code === 'en_US' ? 'USD' : 'MXN',
                                amount_1000: Math.trunc(per_credit_price * 1000)
                            }
                        },
                        {
                            type: 'text',
                            text: `${credit_threshold}`
                        }
                    ]
                }
            ]
        }
    }
}

export const GetSubscriptionActivatedRequestUS = (to: string) => new SubscriptionActivatedTemplate(to, 'en_US', 3.99, 0.01, 20);
export const GetSubscriptionActivatedRequestMX = (to: string) => new SubscriptionActivatedTemplate(to, 'es_MX', 49, 0.01, 25);