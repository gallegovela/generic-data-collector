import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { PdfEntry, PdfModel } from "@/lib/outputs/pdf-model";

export type PdfImage = { bytes: Uint8Array; mime: "image/jpeg" | "image/png" };
/** key -> imagen cargada; una clave ausente se pinta como texto de sustitución. */
export type PdfImageEntry = PdfImage | { placeholder: string };
export type PdfImageMap = Map<string, PdfImageEntry>;

function isImage(value: PdfImageEntry): value is PdfImage {
  return "bytes" in value;
}

function styles(model: PdfModel) {
  return StyleSheet.create({
    page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
    band: { height: 6, backgroundColor: model.theme.primaryColor, marginBottom: 12 },
    header: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
    logo: { width: 48, height: 48, objectFit: "contain", marginRight: 10 },
    org: { fontSize: 11, color: model.theme.secondaryColor },
    title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: model.theme.primaryColor },
    meta: { fontSize: 9, color: "#4b5563", marginBottom: 2 },
    notice: { marginVertical: 8, padding: 6, backgroundColor: "#fef3c7", fontSize: 9 },
    section: {
      marginTop: 12,
      fontSize: 12,
      fontFamily: "Helvetica-Bold",
      color: model.theme.primaryColor,
    },
    entry: { marginTop: 6 },
    label: { fontSize: 9, color: model.theme.secondaryColor },
    value: { fontSize: 11 },
    image: { maxWidth: 220, maxHeight: 160, objectFit: "contain", marginTop: 4, marginRight: 6 },
    images: { flexDirection: "row", flexWrap: "wrap" },
    footer: { position: "absolute", bottom: 18, left: 36, right: 36, fontSize: 8, color: "#6b7280" },
  });
}

function renderEntry(entry: PdfEntry, s: ReturnType<typeof styles>, images: PdfImageMap, index: number) {
  if (entry.kind === "section") {
    return (
      <Text key={index} style={s.section}>
        {entry.label}
      </Text>
    );
  }
  if (entry.kind === "text") {
    return (
      <View key={index} style={s.entry} wrap={false}>
        <Text style={s.label}>{entry.label}</Text>
        <Text style={s.value}>{entry.value}</Text>
      </View>
    );
  }
  return (
    <View key={index} style={s.entry}>
      <Text style={s.label}>{entry.label}</Text>
      <View style={s.images}>
        {entry.images.map((ref, i) => {
          const loaded = images.get(ref.key);
          if (loaded && isImage(loaded)) {
            // eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, no un <img> HTML
            return <Image key={i} style={s.image} src={Buffer.from(loaded.bytes)} />;
          }
          return (
            <Text key={i} style={s.value}>
              {loaded ? loaded.placeholder : "[imagen no disponible]"}
            </Text>
          );
        })}
      </View>
      {entry.omitted > 0 ? (
        <Text style={s.meta}>{`${entry.omitted} imagen(es) no incluida(s) en el PDF`}</Text>
      ) : null}
    </View>
  );
}

/** Solo presentación: pinta el modelo ya calculado. Cubre: RF-OUT-03 */
export async function renderSubmissionPdf(
  model: PdfModel,
  images: PdfImageMap,
  opts: { notice?: string; submissionId: string },
): Promise<Buffer> {
  const s = styles(model);
  const logo = model.theme.logo ? images.get(model.theme.logo.key) : undefined;
  const document = (
    <Document title={model.formTitle}>
      <Page size="A4" style={s.page}>
        <View style={s.band} />
        <View style={s.header}>
          {logo && isImage(logo) ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, no un <img> HTML
            <Image style={s.logo} src={Buffer.from(logo.bytes)} />
          ) : null}
          <View>
            <Text style={s.org}>{model.organizationName}</Text>
            <Text style={s.title}>{model.formTitle}</Text>
          </View>
        </View>
        <Text style={s.meta}>{model.versionLabel}</Text>
        <Text style={s.meta}>{`Captura: ${model.capturedAt} · Sincronización: ${model.syncedAt}`}</Text>
        {model.submittedByName ? (
          <Text style={s.meta}>{`Enviado por: ${model.submittedByName}`}</Text>
        ) : null}
        {opts.notice ? <Text style={s.notice}>{opts.notice}</Text> : null}
        {model.entries.map((entry, i) => renderEntry(entry, s, images, i))}
        <Text style={s.footer} fixed>
          {`Respuesta ${opts.submissionId} · FormIA`}
        </Text>
      </Page>
    </Document>
  );
  return renderToBuffer(document);
}
