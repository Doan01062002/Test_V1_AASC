/**
 * Bitrix24 CRM Types & Schemas
 */

export interface Bitrix24MultifieldItem {
  VALUE: string;
  VALUE_TYPE: 'WORK' | 'HOME' | 'MOBILE' | 'OTHER';
}

export interface Bitrix24ContactFields {
  NAME: string;
  LAST_NAME?: string;
  PHONE?: Bitrix24MultifieldItem[];
  EMAIL?: Bitrix24MultifieldItem[];
  COMMENTS?: string;
  OPENED?: 'Y' | 'N';
  EXPORT?: 'Y' | 'N';
  SOURCE_ID?: string;
  SOURCE_DESCRIPTION?: string;
  [key: string]: unknown;
}

export interface Bitrix24ContactParams {
  REGISTER_SONET_EVENT?: 'Y' | 'N';
}

export interface Bitrix24ContactPayload {
  fields: Bitrix24ContactFields;
  params?: Bitrix24ContactParams;
}

export interface Bitrix24AddResponse {
  result: number;
  time?: {
    start: number;
    finish: number;
    duration: number;
    processing: number;
    date_start: string;
    date_finish: string;
  };
}

export interface Bitrix24ErrorResponse {
  error: string;
  error_description?: string;
}
