import {api_keys, config} from './constants';

type lang = 'en_us' | 'es_mx';

type stringsNames = 'test' | 'thing'

type promptNames = 'prompt1' | 'prompt2'

type iStrings = {
        'prompts': Record<promptNames, Record<lang, string>>;
        'strings': Record<stringsNames, Record<lang, string>>;
}

export const strings: iStrings = {
    'prompts': {
        "prompt1": {
            'en_us': 'test',
            'es_mx': 'test2'
        },
        "prompt2": {
            'en_us': 'test',
            'es_mx': 'test2'
        }
    },
    "strings": {
        'test': {
            'en_us': 'str1',
            'es_mx': 'str2'
        },
        'thing': {
            'en_us': 'str1',
            'es_mx': 'str2'
        }
    }
}

export const constants = {
    api_keys,
    config
};