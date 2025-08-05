/**
 * Example of how to use the LastUpdated component with proper error handling
 * This demonstrates the improved API that doesn't rely on console mocking
 */

import { LastUpdated, type ValidationError } from '../last-updated';
import { useState } from 'react';

export function ExampleUsage() {
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const handleValidationError = (error: ValidationError) => {
    // In production, you might want to:
    // 1. Log to an error tracking service
    // 2. Show user-friendly error messages
    // 3. Fallback to a default behavior
    console.error('Timestamp validation failed:', error);
    setValidationErrors(prev => [...prev, error]);
  };

  return (
    <div>
      {/* Valid usage - will render normally */}
      <LastUpdated 
        timestamp="2024-01-15T10:00:00Z"
        onValidationError={handleValidationError}
      />
      
      {/* Invalid usage - will call error handler */}
      <LastUpdated 
        timestamp="invalid-date"
        onValidationError={handleValidationError}
      />
      
      {/* Malicious input - will be detected and handled */}
      <LastUpdated 
        timestamp="<script>alert('xss')</script>"
        onValidationError={handleValidationError}
      />
      
      {validationErrors.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="font-semibold text-red-800">Validation Errors:</h3>
          <ul className="mt-2 space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index} className="text-sm text-red-700">
                {error.type}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}