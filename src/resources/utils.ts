import { F_OK } from "constants";
import { createHash } from "crypto";
import { access, mkdir, appendFile, readFile } from "fs";
import path from "path";
import { promisify } from "util";
import { constants } from ".";

const accessAsync = promisify(access);
const mkdirAsync = promisify(mkdir);
const appendFileAsync = promisify(appendFile);
const readFileAsync = promisify(readFile)

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
      await appendFileAsync(destination, data);
    } catch (error: any) {
      console.error(`Error appending to file '${destination}': ${error}`);
      throw error;
    }
}

export async function getFileJson<T>(filePathParts: string[]): Promise<T> {
    const destination = path.join(...filePathParts);
    try {
      const data = JSON.parse((await readFileAsync(destination)).toString());
      return data as T;
    } catch (error: any) {
      console.error(`Error reading file '${destination}': ${error}`);
      throw error;
    }
}

export function sha256(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

