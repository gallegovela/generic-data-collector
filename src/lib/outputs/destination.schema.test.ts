import { describe, expect, it } from "vitest";
import { saveEmailDestinationSchema, saveWebhookDestinationSchema } from "./destination.schema";

describe("destination.schema", () => {
  it("CA-OUT-10: normaliza emails, quita duplicados y exige entre 1 y 10", () => {
    const ok = saveEmailDestinationSchema.parse({ emails: [" A@Empresa.com ", "a@empresa.com", "b@x.com"] });
    expect(ok.emails).toEqual(["a@empresa.com", "b@x.com"]);
    expect(ok.enabled).toBe(true);
    expect(saveEmailDestinationSchema.safeParse({ emails: [] }).success).toBe(false);
    const eleven = Array.from({ length: 11 }, (_, i) => `u${i}@x.com`);
    expect(saveEmailDestinationSchema.safeParse({ emails: eleven }).success).toBe(false);
    expect(saveEmailDestinationSchema.safeParse({ emails: ["no-es-email"] }).success).toBe(false);
  });

  it("CA-OUT-10: la URL privada devuelve el mensaje en español", () => {
    const result = saveWebhookDestinationSchema.safeParse({ url: "http://10.0.0.5/hook" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("La URL apunta a una dirección privada o no permitida.");
    expect(saveWebhookDestinationSchema.safeParse({ url: "ftp://x.com" }).error?.issues[0].message).toBe(
      "Solo se admiten URLs http o https.",
    );
    expect(saveWebhookDestinationSchema.safeParse({ url: "x y" }).error?.issues[0].message).toBe(
      "La URL no es válida.",
    );
    expect(saveWebhookDestinationSchema.safeParse({ url: "https://example.com/hook" }).success).toBe(true);
  });
});
