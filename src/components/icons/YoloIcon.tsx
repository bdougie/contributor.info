import React from 'react';

export const YoloIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="15" 
    height="21" 
    viewBox="0 0 15 21" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M6.75905 0.5C5.527 0.5 4.51151 1.46819 4.51151 2.64286V3.73661L4.41787 3.44643C4.06084 2.32199 2.78782 1.67746 1.60845 2.01786C0.429082 2.35826 -0.246933 3.57199 0.110097 4.69643L2.05328 10.7232C1.91281 10.7762 1.76063 10.8376 1.60845 10.9241C0.982187 11.2812 0.273979 12.0039 0.0632732 13.1562C-0.0947561 14.01 0.0779054 14.7606 0.203744 15.1652C0.203744 15.1735 0.203744 15.1791 0.203744 15.1875L0.789039 16.9732C1.46505 19.0686 3.50188 20.5 5.79916 20.5H9.75576C12.6442 20.5 15 18.2539 15 15.5V8.42411C15 8.39341 15 8.36551 15 8.33482C15 8.32087 15 8.30413 15 8.29018C15 8.28181 15 8.27623 15 8.26786C14.9941 8.24554 14.9854 8.22321 14.9766 8.20089C14.9093 7.41406 14.4089 6.68025 13.5953 6.37054C13.0305 6.15569 12.4364 6.18638 11.9096 6.39286C11.6667 5.9548 11.2746 5.58371 10.7625 5.38839C10.1742 5.16518 9.54798 5.20145 9.00658 5.43304V2.64286C9.00658 1.46819 7.99109 0.5 6.75905 0.5ZM6.75905 1.92857C7.18339 1.92857 7.50822 2.23828 7.50822 2.64286V7.35268L6.73564 9.22768C6.62443 9.49275 6.57175 9.78013 6.57175 10.0536L3.50481 10.433L1.56163 4.27232C1.43872 3.88728 1.64942 3.49665 2.05328 3.37946C2.45713 3.26228 2.86684 3.48549 2.98975 3.87054L4.53493 8.75893L5.37775 8.51339H6.00987V2.64286C6.00987 2.23828 6.33471 1.92857 6.75905 1.92857ZM9.89623 6.66071C9.9928 6.65792 10.104 6.66909 10.2006 6.70536C10.5927 6.85603 10.78 7.26897 10.622 7.64286L9.82599 9.54018V9.5625L9.52164 10.2991C9.50701 10.3382 9.47189 10.3549 9.4514 10.3884C9.07096 10.1066 8.59102 9.92522 8.09352 9.91964C8.1023 9.86663 8.09352 9.81641 8.11693 9.76339L9.2407 7.10714C9.35776 6.82534 9.60651 6.6663 9.89623 6.66071ZM12.7291 7.64286C12.8286 7.64286 12.9339 7.65123 13.0334 7.6875C13.329 7.79911 13.4958 8.05301 13.5016 8.33482C13.5016 8.34319 13.5016 8.34877 13.5016 8.35714C13.5016 8.44364 13.4899 8.5385 13.4548 8.625L12.612 10.6116C12.454 10.9855 12.0208 11.1641 11.6287 11.0134C11.2366 10.8627 11.0727 10.4498 11.2307 10.0759L12.0267 8.17857C12.0384 8.15067 12.0384 8.11719 12.0501 8.08929C12.1291 7.90234 12.2725 7.76005 12.4481 7.6875C12.5359 7.65123 12.6296 7.64286 12.7291 7.64286ZM7.88281 11.3259C8.27789 11.2366 8.6554 11.4626 8.74905 11.8393C8.80758 12.0709 8.77539 12.1881 8.70223 12.308C8.62906 12.428 8.47396 12.5759 8.14034 12.6875L4.51151 13.5804C4.2891 13.6362 4.10766 13.7868 4.01694 13.9849C3.92622 14.1858 3.935 14.4146 4.04328 14.6071L4.72222 15.7902C4.92122 16.1362 5.37775 16.2617 5.74063 16.0692C6.10352 15.8795 6.23521 15.4442 6.03328 15.0982L5.82258 14.7411L8.58517 14.0491C8.60858 14.0435 8.63199 14.0352 8.6554 14.0268C9.23485 13.8343 9.70015 13.505 9.98987 13.0446C10.2269 12.668 10.3176 12.2299 10.2708 11.7946C10.4903 12.0206 10.7712 12.2076 11.0902 12.3304C11.9477 12.6568 12.89 12.4503 13.5016 11.8616V15.5C13.5016 17.481 11.8336 19.0714 9.75576 19.0714H5.79916C4.15156 19.0714 2.70295 18.0502 2.21716 16.5491L1.65528 14.7634C1.59382 14.5709 1.47091 13.8956 1.56163 13.4018C1.7021 12.6345 2.05328 12.3387 2.38104 12.1518C2.70881 11.9648 2.94292 11.9509 2.94292 11.9509C2.95756 11.9509 2.97512 11.9509 2.98975 11.9509L7.81258 11.3482C7.83599 11.3426 7.8594 11.3343 7.88281 11.3259Z" 
      fill="currentColor"
    />
  </svg>
);