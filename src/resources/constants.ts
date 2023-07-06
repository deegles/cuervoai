export const api_keys = {
    openai: process.env.OPENAI_API_KEY,
    whatsapp: process.env.WHATSAPP_API_KEY,
    stripe_public: process.env.STRIPE_PUBLIC_KEY || '',
    stripe_private: process.env.STRIPE_PRIVATE_KEY || '',
    stripe_wh_secret: process.env.STRIPE_WH_SECRET || '',
}

export const config = {
    openai_org: process.env.OPENAI_ORG_PROD,
    whatsapp_verify_token: "659631c882fc11eda1eb0242ac120002",
    mount_root: '/mnt/data',
    stripe_api_version: '2022-11-15'
}