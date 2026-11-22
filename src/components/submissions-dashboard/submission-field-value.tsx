import type { FieldDisplayValue } from "@/lib/submissions-dashboard/field-display";
import { resolvePlaceholderFileUrl } from "@/lib/submissions-dashboard/file-placeholder";
import { SubmissionMap } from "./submission-map";

/** Pinta el valor de un campo en la ficha (solo lectura). Cubre: RF-SUB-08, CA-SUB-03, CA-SUB-09 */
export function SubmissionFieldValue({ value }: { value: FieldDisplayValue }) {
  switch (value.kind) {
    case "section":
      return null;
    case "empty":
      return <span className="text-muted-foreground">Sin respuesta</span>;
    case "text":
      return <span className="whitespace-pre-wrap">{value.text}</span>;
    case "photos":
      return (
        <ul className="flex flex-wrap gap-2">
          {value.files.map((file, i) => {
            const url = resolvePlaceholderFileUrl(file, "photo");
            return (
              <li key={`${file.key}-${i}`}>
                <a href={url} target="_blank" rel="noopener noreferrer" data-testid="photo-thumbnail">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Foto ${i + 1}`} className="h-24 w-32 rounded-md border object-cover" />
                </a>
              </li>
            );
          })}
        </ul>
      );
    case "signature": {
      const url = resolvePlaceholderFileUrl(value.file, "signature");
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" data-testid="signature-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Firma" className="h-24 w-48 rounded-md border bg-white object-contain" />
        </a>
      );
    }
    case "gps":
      return <SubmissionMap lat={value.value.lat} lng={value.value.lng} accuracy={value.value.accuracy} />;
  }
}
