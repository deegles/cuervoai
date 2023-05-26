import { Configuration, CreateCompletionRequest, OpenAIApi } from "openai";
import { constants } from "../../resources";

const {config, api_keys} = constants;

const configuration = new Configuration({
    organization: config.openai_org,
    apiKey: api_keys.openai,
});

const openai = new OpenAIApi(configuration);

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

const getCompletion = async (prompt: string): Promise<string> => {
    const response = await openai.createCompletion(completionConfig(prompt));

    const text = response.data?.choices?.map(({text})=> text).join(' ') || 'no response';

    console.log('openai response: ', response.data, response.status, response.statusText);

    
    return text;
}


export {
    getCompletion
}