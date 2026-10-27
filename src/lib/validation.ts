/**
 * Form and entity validation logic for Cold Call Copilot
 * 
 * Centralizes validation rules away from presentation components,
 * ensuring consistent error messaging and edge-case protection.
 */

export interface ValidationErrors {
  [field: string]: string;
}

/**
 * Validates prospect fields.
 */
export function validateProspectForm(data: {
  companyName: string;
  email?: string;
  phone?: string;
  website?: string;
}): ValidationErrors {
  const errors: ValidationErrors = {};

  // Company Name
  const trimmedName = data.companyName ? data.companyName.trim() : '';
  if (!trimmedName) {
    errors.companyName = 'Company name is required';
  } else if (trimmedName.length < 2) {
    errors.companyName = 'Company name must be at least 2 characters';
  }

  // Email format
  if (data.email && data.email.trim() !== '') {
    const trimmedEmail = data.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      errors.email = 'Please provide a valid email address (e.g. name@company.com)';
    }
  }

  // Phone format
  if (data.phone && data.phone.trim() !== '') {
    const trimmedPhone = data.phone.trim();
    // Allow digits, spaces, parentheses, hyphens, plus sign
    const phoneRegex = /^[\d\s+\-()]{7,25}$/;
    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (!phoneRegex.test(trimmedPhone) || digitsOnly.length < 7) {
      errors.phone = 'Please provide a valid phone number with at least 7 digits';
    }
  }

  // Website format
  if (data.website && data.website.trim() !== '') {
    const trimmedWebsite = data.website.trim();
    const domainRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
    if (!domainRegex.test(trimmedWebsite)) {
      errors.website = 'Please provide a valid website address (e.g. company.com)';
    }
  }

  return errors;
}

/**
 * Validates follow-up task form.
 */
export function validateFollowUpForm(data: {
  prospectId: string;
  task: string;
  dueDate: string;
}): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!data.prospectId || data.prospectId.trim() === '') {
    errors.prospectId = 'Please select an associated prospect account';
  }

  const trimmedTask = data.task ? data.task.trim() : '';
  if (!trimmedTask) {
    errors.task = 'Follow-up task description is required';
  } else if (trimmedTask.length < 3) {
    errors.task = 'Task description must be at least 3 characters';
  }

  if (!data.dueDate || data.dueDate.trim() === '') {
    errors.dueDate = 'Due date is required';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)) {
    errors.dueDate = 'Please provide a valid date format (YYYY-MM-DD)';
  }

  return errors;
}

/**
 * Validates call workspace preparation and completion.
 */
export function validateCallCompletion(data: {
  prospectId: string;
  callObjective: string;
  callNotes?: string;
  businessProblemNotes?: string;
  outcome?: string;
  nextAction?: string;
  followUpDate?: string;
}): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!data.prospectId || data.prospectId.trim() === '') {
    errors.prospectId = 'A prospect must be selected to log a call';
  }

  if (!data.callObjective || data.callObjective.trim() === '') {
    errors.callObjective = 'Call objective is required';
  }

  if (!data.outcome || data.outcome.trim() === '') {
    errors.outcome = 'Please select a call outcome before completing the call';
  }

  // If next action is specified, make sure a date is selected
  if (data.nextAction && data.nextAction.trim() !== '' && !data.followUpDate) {
    errors.followUpDate = 'Follow-up target date is required when scheduling a next action';
  }

  return errors;
}
