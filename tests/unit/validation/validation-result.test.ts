import { describe, it, expect } from 'vitest';
import { ValidationResult } from '../../../src/services/validation/validation-result.js';

describe('ValidationResult', () => {
  it('success creates valid result', () => {
    const result = ValidationResult.success('All good');
    expect(result.isValid).toBe(true);
    expect(result.status).toBe('VALID');
    expect(result.details).toBe('All good');
  });

  it('failure creates invalid result', () => {
    const result = ValidationResult.failure('ERROR', 'Something broke');
    expect(result.isValid).toBe(false);
    expect(result.status).toBe('ERROR');
    expect(result.details).toBe('Something broke');
  });

  it('notConfigured creates invalid result with NOT CONFIGURED status', () => {
    const result = ValidationResult.notConfigured('Missing URL');
    expect(result.isValid).toBe(false);
    expect(result.status).toBe('NOT CONFIGURED');
  });

  it('addError adds to errors list and sets invalid', () => {
    const result = new ValidationResult({ isValid: true });
    result.addError('error1');
    expect(result.errors).toContain('error1');
    expect(result.isValid).toBe(false);
  });

  it('addWarning adds to warnings list', () => {
    const result = new ValidationResult({});
    result.addWarning('warning1');
    expect(result.warnings).toContain('warning1');
  });

  it('addInfo adds to info list', () => {
    const result = new ValidationResult({});
    result.addInfo('info1');
    expect(result.info).toContain('info1');
  });

  it('multiple errors all collected', () => {
    const result = new ValidationResult({});
    result.addError('e1');
    result.addError('e2');
    result.addError('e3');
    expect(result.errors).toHaveLength(3);
  });
});
