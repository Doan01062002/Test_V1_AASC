/**
 * Common DTOs and API Response Types
 */

export interface NormalizedContact {
  name: string;
  lastName?: string;
  email: string;
  phone: string;
  submissionId?: string;
  formId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
  details?: string[];
  timestamp: string;
}
