import { F_OK } from "constants";
import { createHash } from "crypto";
import { access, mkdir, appendFile, readFile, writeFile, rename } from "fs";
import path from "path";
import { promisify } from "util";
import { constants } from ".";

const accessAsync = promisify(access);
const mkdirAsync = promisify(mkdir);
const appendFileAsync = promisify(appendFile);
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const renameFileAsync = promisify(rename);

async function ensureDirectoryExists(filePathParts: string[]) {
    const directoryPath = path.join(...filePathParts);
    try {
        await accessAsync(directoryPath, F_OK);
    } catch (error: any) {
        if (error?.code === 'ENOENT') {
            try {
                await mkdirAsync(directoryPath, { recursive: true });
            } catch (error: any) {
                console.error(`Error creating directory '${directoryPath}': ${error}`);
            }
        } else {
            console.error(`Error checking directory existence '${directoryPath}': ${error}`);
        }
    }
}

export async function appendToFile(filePathParts: string[], data: string): Promise<void> {
    const destination = path.join(...filePathParts);

    try {
        await ensureDirectoryExists(filePathParts.slice(0, -1));

        const withNewLine = data.endsWith('\n') ? data : `${data}\n`;
        await appendFileAsync(destination, withNewLine, { flag: 'a' });
    } catch (error: any) {
        console.error(`Error appending to file '${destination}': ${error}`);
        throw error;
    }
}

export async function getFileJson<T>(filePathParts: string[]): Promise<T[]> {

    const destination = path.join(...filePathParts);
    try {
        await accessAsync(destination); // Check file existence
        const fileContent = (await readFileAsync(destination)).toString();
        const lines = fileContent.split('\n');
        const parsedData: T[] = [];

        let buffer = '';
        for (const line of lines) {
            buffer += line.trim();

            try {
                const parsedLine = JSON.parse(buffer) as T;
                parsedData.push(parsedLine);
                buffer = '';
            } catch (error) {
                // JSON parsing error, the line may not be complete yet
                // Skip the incomplete JSON object and continue to the next line
                continue;
            }
        }

        return parsedData;
    } catch (error: any) {
        if (error?.code === 'ENOENT') {
            return []; // File doesn't exist, return empty array
        }

        console.error(`Error reading file '${destination}': ${error}`);
        throw error;
    }
}


export async function writeFileWithLock(filePathParts: string[], data: string) {
    const destination = path.join(...filePathParts);
    await ensureDirectoryExists(filePathParts.slice(0, -1));

    // lock file before write?

}

export async function writeFileContent(filePathParts: string[], data: string): Promise<void> {
    const destination = path.join(...filePathParts);
    
    try {
        await ensureDirectoryExists(filePathParts.slice(0, -1));
        await writeFileAsync(destination, data);
    } catch(error: any) {
        console.error(`Error writing file '${destination}': ${error}`);
        throw error;
    }
}

export async function moveFile(filePathParts: string[], destPathParts: string[]): Promise<void> {
    const source = path.join(...filePathParts);
    const dest = path.join(...destPathParts);
    
    try {
        await ensureDirectoryExists(filePathParts.slice(0, -1));
        await ensureDirectoryExists(destPathParts.slice(0, -1));

        await renameFileAsync(source, dest);
    } catch(error: any) {
        console.error(`Error moving file '${source}': ${error}`);
        throw error;
    }
}

export function sha256(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

