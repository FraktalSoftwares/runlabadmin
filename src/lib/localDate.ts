export type LocalDate = string & { readonly __brand: "LocalDate" };

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const OPERATIONAL_TIME_ZONE = "America/Sao_Paulo";

function assertCalendarDate(year: number, month: number, day: number): void {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    throw new Error(`Data civil inválida: ${year}-${month}-${day}`);
  }
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string") return false;
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;
  try {
    assertCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
    return true;
  } catch {
    return false;
  }
}

export function parseLocalDate(value: string): LocalDate {
  if (!isLocalDate(value)) {
    throw new Error(`Data civil inválida: ${value}`);
  }
  return value;
}

export function localDateFromCalendar(date: Date): LocalDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return parseLocalDate(`${year}-${month}-${day}`);
}

export function calendarFromLocalDate(value: LocalDate | null): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function localDateFromLegacyTimestamp(
  value: string | null | undefined,
): LocalDate | null {
  if (!value) return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Timestamp legado inválido: ${value}`);
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return parseLocalDate(`${values.year}-${values.month}-${values.day}`);
}

export function resolveLocalDate(
  value: string | null | undefined,
  legacyValue: string | null | undefined,
): LocalDate | null {
  if (value !== null && value !== undefined) return parseLocalDate(value);
  return localDateFromLegacyTimestamp(legacyValue);
}

export function formatLocalDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  },
): string {
  if (!value) return "-";
  const date = parseLocalDate(value);
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatLocalDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start && !end) return "-";
  const formattedStart = start ? formatLocalDate(start) : "";
  const formattedEnd = end ? formatLocalDate(end) : "";
  if (formattedStart && formattedEnd) {
    return `${formattedStart} - ${formattedEnd}`;
  }
  return formattedStart || formattedEnd;
}
