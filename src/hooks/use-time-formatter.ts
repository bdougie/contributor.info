/**
 * Hook providing time and date formatting utilities
 */
export function useTimeFormatter() {
  /**
   * Formats a date as a relative time (e.g., "2 hours ago")
   * @param date - Date string or Date object to format
   * @returns Formatted relative time string
   */
  const formatRelativeTime = (date: string | Date): string => {
    const nowTimestamp = Date.now();
    const targetTimestamp = typeof date === 'string' ? Date.parse(date) : date.getTime();

    if (isNaN(targetTimestamp)) return 'Unknown';

    const diffInSeconds = Math.floor((nowTimestamp - targetTimestamp) / 1000);

    if (diffInSeconds < 0) return 'Just now';
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  };

  /**
   * Formats a date as a locale string (e.g., "Jan 1, 2023")
   * @param date - Date string or Date object to format
   * @param options - Intl.DateTimeFormatOptions for customizing the format
   * @returns Formatted date string
   */
  const formatDate = (
    date: string | Date,
    options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  ): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString(undefined, options);
  };

  /**
   * Formats a date as a locale time string (e.g., "3:45 PM")
   * @param date - Date string or Date object to format
   * @param options - Intl.DateTimeFormatOptions for customizing the format
   * @returns Formatted time string
   */
  const formatTime = (
    date: string | Date,
    options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: 'numeric',
    }
  ): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString(undefined, options);
  };

  /**
   * Formats a date range between two dates
   * @param startDate - Start date string or Date object
   * @param endDate - End date string or Date object
   * @returns Formatted date range string
   */
  const formatDateRange = (startDate: string | Date, endDate: string | Date): string => {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: start.getFullYear() !== end.getFullYear() ? 'numeric' : undefined,
    };

    const startStr = start.toLocaleDateString(undefined, options);

    // Include year in end date if different from start year
    options.year = 'numeric';
    const endStr = end.toLocaleDateString(undefined, options);

    return `${startStr} - ${endStr}`;
  };

  /**
   * Calculates the time difference between two dates in a human-readable format
   * @param startDate - Start date string or Date object
   * @param endDate - End date string or Date object
   * @returns Human-readable time difference
   */
  const getTimeDifference = (
    startDate: string | Date,
    endDate: string | Date = new Date()
  ): string => {
    const startTimestamp =
      typeof startDate === 'string' ? Date.parse(startDate) : startDate.getTime();
    const endTimestamp = typeof endDate === 'string' ? Date.parse(endDate) : endDate.getTime();

    if (isNaN(startTimestamp) || isNaN(endTimestamp)) return 'Unknown duration';

    const diffInSeconds = Math.floor((endTimestamp - startTimestamp) / 1000);

    if (diffInSeconds < 0) return '0 seconds';

    if (diffInSeconds < 60) return `${diffInSeconds} seconds`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months`;
    return `${Math.floor(diffInSeconds / 31536000)} years`;
  };

  return {
    formatRelativeTime,
    formatDate,
    formatTime,
    formatDateRange,
    getTimeDifference,
  };
}
