import { Configuration, CreateCompletionRequest, CreateCompletionResponse, OpenAIApi } from "openai";
import { constants } from "../../resources";

const {config, api_keys} = constants;

const configuration = new Configuration({
    organization: config.openai_org,
    apiKey: api_keys.openai,
});

const openai = new OpenAIApi(configuration);

export type OpenAiModels = 'text-davinci-003' | 'gpt-3.5-turbo';

const completionConfig = (prompt: string, stop = '<|endoftext|>'): CreateCompletionRequest =>({
    "model": "text-davinci-003",
    prompt: `${prompt}${stop}`,
    "max_tokens": 1024,
    "temperature": 0,
    "top_p": 1,
    "n": 1,
    "stream": false,
    "logprobs": null,
    stop
  })

const getCompletion = async (prompt: string): Promise<CreateCompletionResponse | null> => {
    console.log('models: ', JSON.stringify((await openai.listModels()).data))
    const response = await openai.createCompletion(completionConfig(prompt));


    console.log('openai response: ', response.data, response.status, response.statusText);

    
    return response.data;
}

const getChatCompletion = async (chats: [string]): Promise<

export {
    getCompletion
}