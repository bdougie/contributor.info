import React from 'react';

export const OdometerIcon = ({ className }: { className?: string }) => (
  <svg 
    width="98" 
    height="49" 
    viewBox="0 0 98 49" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M98 49C98 36.0044 92.8375 23.5411 83.6482 14.3518C74.459 5.16249 61.9956 9.81141e-07 49 0C36.0044 -9.81141e-07 23.5411 5.16248 14.3518 14.3518C5.16249 23.541 1.96228e-06 36.0044 0 49H7.84C7.84 38.0837 12.1765 27.6145 19.8955 19.8955C27.6145 12.1765 38.0837 7.84 49 7.84C59.9163 7.84 70.3855 12.1765 78.1045 19.8955C85.8235 27.6145 90.16 38.0837 90.16 49H98Z" 
      fill="currentColor"
    />
  </svg>
);