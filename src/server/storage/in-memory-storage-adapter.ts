import type { StorageAdapter } from "./storage-adapter";

/** Adaptador en memoria para tests. `objects` permite inspeccionar lo guardado. */
export class InMemoryStorageAdapter implements StorageAdapter {
  readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  async put(input: { key: string; body: Uint8Array; contentType: string }): Promise<void> {
    this.objects.set(input.key, { body: input.body, contentType: input.contentType });
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    if (expiresInSeconds > 900) {
      throw new Error("La URL firmada no puede durar más de 900 segundos.");
    }
    return `https://storage.test/${key}?expires=${expiresInSeconds}`;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  async get(key: string): Promise<Uint8Array> {
    const object = this.objects.get(key);
    if (!object) throw new Error("Objeto no encontrado.");
    return object.body;
  }
}
