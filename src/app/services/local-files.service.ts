import { Injectable } from '@angular/core';
import { set, get, del, keys } from 'idb-keyval';

@Injectable({
  providedIn: 'root',
})
export class LocalFilesService {
  private FILE_STORE_PREFIX = 'localMusicFile_';

  constructor() {}

  async addFile(file: File): Promise<void> {
    await set(this.FILE_STORE_PREFIX + file.name, file);
  }

  async removeFile(filename: string): Promise<void> {
    await del(this.FILE_STORE_PREFIX + filename);
  }

  async getFile(filename: string): Promise<File | undefined> {
    return await get(this.FILE_STORE_PREFIX + filename);
  }

  async getAllFiles(): Promise<File[]> {
    const allKeys = await keys();
    const fileKeys = allKeys.filter(
      (k: unknown) => typeof k === 'string' && k.startsWith(this.FILE_STORE_PREFIX)
    );
    const files: File[] = [];
    for (const key of fileKeys) {
      const file = await get(key);
      if (file) files.push(file);
    }
    return files;
  }

  async clearAllFiles(): Promise<void> {
    const allKeys = await keys();
    const fileKeys = allKeys.filter(
      (k: unknown) => typeof k === 'string' && k.startsWith(this.FILE_STORE_PREFIX)
    );
    for (const key of fileKeys) {
      await del(key);
    }
  }
}
