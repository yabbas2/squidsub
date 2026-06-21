export class ValidationResult {
  isValid: boolean;
  status: string;
  details: string;
  errors: string[] = [];
  warnings: string[] = [];
  info: string[] = [];

  constructor(init?: Partial<ValidationResult>) {
    this.isValid = init?.isValid ?? false;
    this.status = init?.status ?? '';
    this.details = init?.details ?? '';
    this.errors = init?.errors ?? [];
    this.warnings = init?.warnings ?? [];
    this.info = init?.info ?? [];
  }

  static success(details: string): ValidationResult {
    return new ValidationResult({ isValid: true, status: 'VALID', details });
  }

  static failure(status: string, details: string): ValidationResult {
    return new ValidationResult({ isValid: false, status, details });
  }

  static notConfigured(details: string): ValidationResult {
    return new ValidationResult({ isValid: false, status: 'NOT CONFIGURED', details });
  }

  addError(error: string): void {
    this.errors.push(error);
    this.isValid = false;
  }

  addWarning(warning: string): void {
    this.warnings.push(warning);
  }

  addInfo(info: string): void {
    this.info.push(info);
  }
}
