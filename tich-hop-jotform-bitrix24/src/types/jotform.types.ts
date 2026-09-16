/**
 * Jotform Types & Schemas
 */

export type JotformNameCompound = {
  first?: string;
  last?: string;
};

export type JotformNameField = JotformNameCompound | string;

export type JotformPhoneCompound = {
  full?: string;
  area?: string;
  phone?: string;
  code?: string;
};

export type JotformPhoneField = JotformPhoneCompound | string;

export type JotformEmailCompound = {
  email?: string;
};

export type JotformEmailField = JotformEmailCompound | string;

export interface JotformWebhookPayload {
  rawRequest?: string;
  submission_id?: string;
  formID?: string;
  q3_name?: JotformNameField;
  q4_email?: JotformEmailField;
  q5_phoneNumber?: JotformPhoneField;
  name?: JotformNameField;
  email?: JotformEmailField;
  phoneNumber?: JotformPhoneField;
  phone?: JotformPhoneField;
  fullName?: JotformNameField;
  [key: string]: unknown;
}

export interface JotformAnswerItem {
  name?: string;
  order?: string;
  text?: string;
  type?: string;
  answer?: any;
  prettyFormat?: string;
}

export interface JotformSubmissionItem {
  id: string;
  form_id: string;
  created_at: string;
  status: string;
  answers: Record<string, JotformAnswerItem>;
}

export interface JotformSubmissionsApiResponse {
  responseCode: number;
  message: string;
  content: JotformSubmissionItem[];
  duration?: string;
  info?: string;
}
