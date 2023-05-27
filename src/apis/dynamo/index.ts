import * as AWS from 'aws-sdk';

AWS.config.update({ region: 'us-east-2' });

const docClient = new AWS.DynamoDB.DocumentClient();

interface DynamoDBTable {
    tableName: string; // todo: typed string
    primaryKeyName: "id";
    primaryKey: string;
}

export interface DynamoDBItem<T> extends DynamoDBTable {
   
}

export class DynamoItemDAL<T> {
    private tableName: string;
    private primaryKeyName: string;
    private primaryKey: string;

    constructor({tableName, primaryKeyName, primaryKey}: DynamoDBItem<T>) {
        this.tableName = tableName;
        this.primaryKeyName = primaryKeyName;
        this.primaryKey = String(primaryKey);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, Math.ceil(ms));
        })
    }

    async getItem<T>(attributeName: keyof T): Promise<T[keyof T] | null> {
        const params = {
            TableName: this.tableName,
            Key: {
                [this.primaryKeyName]: this.primaryKey
            }
        };

        try {
            const data = await docClient.get(params).promise();
            const item = data?.Item;
            console.log('got: ', data)
            return item ? item.d?.[attributeName] : null;
        } catch (error) {
            console.error("Unable to retrieve item. Error: ", error);
            return null;
        }
    }

    async updateItem<T>(attributeName: keyof T, newValue: T[keyof T]): Promise<null> {
        const attributeParams = {
            TableName: this.tableName,
            Key: {
                [this.primaryKeyName]: this.primaryKey
            },
            UpdateExpression: `set d.${String(attributeName)} = :v`,
            ExpressionAttributeValues: {
                ':v': newValue
            },
            ReturnValues: "NONE"
        };

        try {
            await docClient.update(attributeParams).promise();
            return null;
        } catch (error: any) {

            if(error?.statusCode === 400 && error?.code === 'ValidationException') {
                await this.sleep(parseFloat(error?.retryDelay || '10') || 10);
                
                const itemParams = {
                    ...attributeParams,
                    UpdateExpression: 'SET #a = :value',
                    ConditionExpression: 'attribute_not_exists(#a)',
                    ExpressionAttributeValues: {
                        ":value": {
                            [String(attributeName)]: newValue
                        },
                    },
                    ExpressionAttributeNames: {
                        '#a': 'd'
                    }
                };

                try{
                    await docClient.update(itemParams).promise();
                } catch(err) {
                    console.error("Unable to create item. Error: ", error);
                }
            }
            console.error("Unable to update item. Error: ", error);

            
            return null;
        }
    }

    async incrementCounter(attributeName: keyof T, incrementValue: number = 1): Promise<number | null> {
        const attributeParams = {
            TableName: this.tableName,
            Key: {
                [this.primaryKeyName]: this.primaryKey
            },
            UpdateExpression: `set d.${String(attributeName)} = if_not_exists(d.${String(attributeName)}, :start) + :inc`,
            ExpressionAttributeValues: {
                ':inc': incrementValue,
                ':start': 0
            },
            ReturnValues: "UPDATED_NEW"
        };

        try {
            const data = await docClient.update(attributeParams).promise();
            console.log('incremented: ', data)
            return (data.Attributes)?.d?.[attributeName] as unknown as number;
        } catch (error: any) {
            console.error("Unable to increment counter. Error: ", error);

            if(error?.statusCode === 400 && error?.code === 'ValidationException') {
                await this.sleep(parseFloat(error?.retryDelay || '10') || 10);
                
                const itemParams = {
                    ...attributeParams,
                    UpdateExpression: 'SET #a = :value',
                    ConditionExpression: 'attribute_not_exists(#a)',
                    ExpressionAttributeValues: {
                        ":value": {
                            [String(attributeName)]: incrementValue
                        },
                    },
                    ExpressionAttributeNames: {
                        '#a': 'd'
                    }
                };

                try{
                    await docClient.update(itemParams).promise();
                } catch(err) {
                    console.error("Unable to create counter. Error: ", error);
                }
            }


            return null;
        }
    }

    async addToSet(attributeName: keyof T, elements: string[]): Promise<string[] | null> {
        const attributeParams = {
            TableName: this.tableName,
            Key: {
                [this.primaryKeyName]: this.primaryKey
            },
            UpdateExpression: `add d.${String(attributeName)} :v`,
            ExpressionAttributeValues: {
                ':v': docClient.createSet(elements)
            },
            ReturnValues: "UPDATED_NEW"
        };

        try {
            const data = await docClient.update(attributeParams).promise();
            return (data.Attributes as T)[attributeName] as unknown as string[];
        } catch (error: any) {

            if(error?.statusCode === 400 && error?.code === 'ValidationException') {
                await this.sleep(parseFloat(error?.retryDelay || '10') || 10);
                
                const itemParams = {
                    ...attributeParams,
                    UpdateExpression: 'SET #a = :value',
                    ConditionExpression: 'attribute_not_exists(#a)',
                    ExpressionAttributeValues: {
                        ":value": docClient.createSet(elements),
                    },
                    ExpressionAttributeNames: {
                        '#a': 'd'
                    }
                };

                try{
                    await docClient.update(itemParams).promise();
                } catch(err) {
                    console.error("Unable to create set. Error: ", error);
                }
            }


            console.error("Unable to add elements to set. Error: ", error);
            return null;
        }
    }

    async removeFromSet(attributeName: keyof T, elements: string[]): Promise<string[] | null> {
        const params = {
            TableName: this.tableName,
            Key: {
                [this.primaryKeyName]: this.primaryKey
            },
            UpdateExpression: `delete d.${String(attributeName)} :v`,
            ExpressionAttributeValues: {
                ':v': docClient.createSet(elements)
            },
            ReturnValues: "UPDATED_NEW"
        };

        try {
            const data = await docClient.update(params).promise();
            return (data.Attributes as T)[attributeName] as unknown as string[];
        } catch (error) {
            console.error("Unable to remove elements from set. Error: ", error);
            return null;
        }
    }
}
