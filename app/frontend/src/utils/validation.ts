// Validation utilities that match backend Pydantic schemas
export interface ValidationError {
  field: string;
  message: string;
  type: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Email validation regex (matches Pydantic EmailStr)
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Password validation (matches backend requirements)
const PASSWORD_MIN_LENGTH = {
  signIn: 8,
  signUp: 10
};

const PASSWORD_REGEX = {
  // At least one uppercase, one lowercase, one number, one special character
  strong: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  // Basic validation for sign-in (just length)
  basic: /^.{8,}$/
};

// Confirmation code validation (6 digits)
const CONFIRMATION_CODE_REGEX = /^\d{6}$/;

export class ValidationService {
  /**
   * Validates email format
   */
  static validateEmail(email: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!email) {
      errors.push({
        field: 'email',
        message: 'Email is required',
        type: 'required'
      });
    } else if (!EMAIL_REGEX.test(email)) {
      errors.push({
        field: 'email',
        message: 'Please enter a valid email address',
        type: 'format'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates password based on operation type
   */
  static validatePassword(password: string, operation: 'signIn' | 'signUp' = 'signIn'): ValidationResult {
    const errors: ValidationError[] = [];
    const minLength = PASSWORD_MIN_LENGTH[operation];
    
    if (!password) {
      errors.push({
        field: 'password',
        message: 'Password is required',
        type: 'required'
      });
    } else {
      if (password.length < minLength) {
        errors.push({
          field: 'password',
          message: `Password must be at least ${minLength} characters long`,
          type: 'minLength'
        });
      }
      
      // For sign-up, enforce stronger password requirements
      if (operation === 'signUp' && !PASSWORD_REGEX.strong.test(password)) {
        errors.push({
          field: 'password',
          message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
          type: 'complexity'
        });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates confirmation code (6 digits)
   */
  static validateConfirmationCode(code: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!code) {
      errors.push({
        field: 'confirmationCode',
        message: 'Confirmation code is required',
        type: 'required'
      });
    } else if (!CONFIRMATION_CODE_REGEX.test(code)) {
      errors.push({
        field: 'confirmationCode',
        message: 'Confirmation code must be 6 digits',
        type: 'format'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates sign-in form data
   */
  static validateSignIn(data: { email: string; password: string }): ValidationResult {
    const emailValidation = this.validateEmail(data.email);
    const passwordValidation = this.validatePassword(data.password, 'signIn');
    
    const allErrors = [...emailValidation.errors, ...passwordValidation.errors];
    
    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }

  /**
   * Validates sign-up form data
   */
  static validateSignUp(data: { email: string; password: string }): ValidationResult {
    const emailValidation = this.validateEmail(data.email);
    const passwordValidation = this.validatePassword(data.password, 'signUp');
    
    const allErrors = [...emailValidation.errors, ...passwordValidation.errors];
    
    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }

  /**
   * Validates forgot password form data
   */
  static validateForgotPassword(data: { email: string }): ValidationResult {
    return this.validateEmail(data.email);
  }

  /**
   * Validates confirm sign-up form data
   */
  static validateConfirmSignUp(data: { email: string; confirmationCode: string }): ValidationResult {
    const emailValidation = this.validateEmail(data.email);
    const codeValidation = this.validateConfirmationCode(data.confirmationCode);
    
    const allErrors = [...emailValidation.errors, ...codeValidation.errors];
    
    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }

  /**
   * Validates confirm forgot password form data
   */
  static validateConfirmForgotPassword(data: { 
    email: string; 
    confirmationCode: string; 
    newPassword: string 
  }): ValidationResult {
    const emailValidation = this.validateEmail(data.email);
    const codeValidation = this.validateConfirmationCode(data.confirmationCode);
    const passwordValidation = this.validatePassword(data.newPassword, 'signUp');
    
    const allErrors = [...emailValidation.errors, ...codeValidation.errors, ...passwordValidation.errors];
    
    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }

  /**
   * Gets field-specific error message
   */
  static getFieldError(errors: ValidationError[], field: string): string | null {
    const fieldError = errors.find(error => error.field === field);
    return fieldError ? fieldError.message : null;
  }

  /**
   * Checks if field has error
   */
  static hasFieldError(errors: ValidationError[], field: string): boolean {
    return errors.some(error => error.field === field);
  }
}

// Password strength indicator
export const getPasswordStrength = (password: string): {
  score: number;
  label: string;
  color: string;
} => {
  if (!password) {
    return { score: 0, label: '', color: 'gray' };
  }

  let score = 0;
  
  // Length check
  if (password.length >= 8) score += 1;
  if (password.length >= 10) score += 1;
  
  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[@$!%*?&]/.test(password)) score += 1;

  // Determine label and color
  if (score <= 2) {
    return { score, label: 'Weak', color: 'red' };
  } else if (score <= 4) {
    return { score, label: 'Fair', color: 'yellow' };
  } else if (score <= 6) {
    return { score, label: 'Good', color: 'blue' };
  } else {
    return { score, label: 'Strong', color: 'green' };
  }
}; 