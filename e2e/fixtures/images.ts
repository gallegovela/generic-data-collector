// Imágenes mínimas válidas para los e2e de field-collector (sin ficheros binarios).

/** PNG de 1x1 píxel. */
export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** JPEG mínimo: solo importa la firma binaria para el servidor. */
export const JPEG_MIN = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9]);

export const photoFile = (name = "foto.png") => ({ name, mimeType: "image/png", buffer: PNG_1X1 });
