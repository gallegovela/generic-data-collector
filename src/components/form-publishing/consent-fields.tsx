"use client";

import { Input } from "@/components/ui/input";

export type ConsentFieldsValue = {
  termsUrl: string;
  privacyUrl: string;
  publisherDeclaration: boolean;
};

export type ConsentFieldName = keyof ConsentFieldsValue;

/**
 * Términos, privacidad y declaración del administrador (solo con acceso público).
 *
 * Cubre: RF-PUB-12, RF-PUB-13, CA-PUB-08
 */
export function ConsentFields({
  value,
  onChange,
  errors,
  disabled = false,
}: {
  value: ConsentFieldsValue;
  onChange: (value: ConsentFieldsValue) => void;
  errors: Partial<Record<ConsentFieldName, string>>;
  disabled?: boolean;
}) {
  return (
    <fieldset
      data-testid="consent-fields"
      className="flex flex-col gap-3 rounded-md border p-3"
      disabled={disabled}
    >
      <legend className="px-1 text-sm font-medium">Términos y condiciones</legend>

      <label className="flex flex-col gap-1 text-sm">
        Enlace a los términos y condiciones
        <Input
          type="url"
          inputMode="url"
          placeholder="https://"
          data-testid="terms-url"
          value={value.termsUrl}
          onChange={(e) => onChange({ ...value, termsUrl: e.target.value })}
        />
        {errors.termsUrl && (
          <span role="alert" data-testid="consent-error-termsUrl" className="text-destructive">
            {errors.termsUrl}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Enlace a la política de privacidad
        <Input
          type="url"
          inputMode="url"
          placeholder="https://"
          data-testid="privacy-url"
          value={value.privacyUrl}
          onChange={(e) => onChange({ ...value, privacyUrl: e.target.value })}
        />
        {errors.privacyUrl && (
          <span role="alert" data-testid="consent-error-privacyUrl" className="text-destructive">
            {errors.privacyUrl}
          </span>
        )}
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          data-testid="publisher-declaration"
          checked={value.publisherDeclaration}
          onChange={(e) => onChange({ ...value, publisherDeclaration: e.target.checked })}
        />
        <span>
          Declaro que son los términos y la política de privacidad de mi organización, que soy
          responsable del tratamiento de los datos que se recojan con este formulario y que acepto
          el contrato de encargo de tratamiento con FormIA.
        </span>
      </label>
      {errors.publisherDeclaration && (
        <span
          role="alert"
          data-testid="consent-error-publisherDeclaration"
          className="text-sm text-destructive"
        >
          {errors.publisherDeclaration}
        </span>
      )}
    </fieldset>
  );
}
