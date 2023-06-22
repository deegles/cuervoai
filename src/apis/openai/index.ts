import { Configuration, CreateChatCompletionRequest, CreateChatCompletionResponse, CreateCompletionRequest, CreateCompletionResponse, OpenAIApi } from "openai";
import { constants } from "../../resources";

const { config, api_keys } = constants;

const configuration = new Configuration({
    organization: config.openai_org,
    apiKey: api_keys.openai,
});

const openai = new OpenAIApi(configuration);

export type OpenAiModels = 'text-davinci-003' | 'gpt-3.5-turbo';

const completionConfig = (prompt: string, stop = '<|endoftext|>'): CreateCompletionRequest => ({
    "model": "text-davinci-003",
    prompt: `${prompt}${stop}`,
    "max_tokens": 3072,
    "temperature": 0,
    "top_p": 1,
    "n": 1,
    "stream": false,
    "logprobs": null,
    stop
})

const getCompletion = async (prompt: string): Promise<CreateCompletionResponse | null> => {
    //console.log('models: ', JSON.stringify((await openai.listModels()).data))
    const response = await openai.createCompletion(completionConfig(prompt));


    console.log('openai response: ', response.data, response.status, response.statusText);


    return response.data;
}

const chatCompletionConfig: CreateChatCompletionRequest = {
    model: 'gpt-3.5-turbo-0613',
    temperature: .8,
    messages: []
}

export interface chatMessage {
    "role": "assistant" | "system" | 'user';
    "content": string;
    name?: string // The name of the author of this message. May contain a-z, A-Z, 0-9, and underscores, with a maximum length of 64 characters.
}

const getChatCompletion = async (messages: chatMessage[], configOverrides: Partial<CreateCompletionRequest> = {}): Promise<CreateChatCompletionResponse | null> => {
    return new Promise((resolve, reject) => {
        const request = {
            ...chatCompletionConfig,
            messages,
            ...configOverrides,
        } as CreateChatCompletionRequest;

        openai.createChatCompletion(request).then((response) => {
            console.log('got chat completion: ' + JSON.stringify(response?.data, null, 2))
            resolve(response?.data);
        }).catch(err => {
            console.log('error with chat request: ', err.response.data?.error)
            reject(err);
        })
    });
}

export {
    getCompletion,
    getChatCompletion
}