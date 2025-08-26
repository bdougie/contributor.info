import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineNotification } from '../OfflineNotification';
import * as useOnlineStatusModule from '@/hooks/useOnlineStatus';

// Mock the useOnlineStatus hook
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn()
}));

describe('OfflineNotification', () => {
  const mockUseOnlineStatus = vi.mocked(useOnlineStatusModule.useOnlineStatus);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render anything when online', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      isSlowConnection: false,
      connectionType: undefined,
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false
    });

    const { container } = render(<OfflineNotification />);
    expect(container.firstChild).toBeNull();
  });

  it('should show offline notification when offline', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: false,
      isSlowConnection: false,
      connectionType: undefined,
      effectiveType: undefined,
      downlink: undefined,
      rtt: undefined,
      saveData: false
    });

    render(<OfflineNotification />);
    
    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.getByText(/Some features may be limited/)).toBeInTheDocument();
  });

  it('should show slow connection warning on 2G', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      isSlowConnection: true,
      connectionType: 'cellular',
      effectiveType: '2g',
      downlink: 0.5,
      rtt: 300,
      saveData: false
    });

    render(<OfflineNotification />);
    
    expect(screen.getByText('Slow connection detected')).toBeInTheDocument();
    expect(screen.getByText(/You're on a 2g connection/)).toBeInTheDocument();
  });

  it('should show _data saver warning when enabled', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      isSlowConnection: false,
      connectionType: 'wifi',
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: true
    });

    render(<OfflineNotification />);
    
    expect(screen.getByText('Slow connection detected')).toBeInTheDocument();
    expect(screen.getByText(/Data saver mode is on/)).toBeInTheDocument();
  });

  it('should apply correct styling for offline notification', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: false,
      isSlowConnection: false,
      connectionType: undefined,
      effectiveType: undefined,
      downlink: undefined,
      rtt: undefined,
      saveData: false
    });

    render(<OfflineNotification />);
    
    const notification = screen.getByText("You're offline").closest('.rounded-lg');
    expect(notification).toHaveClass('bg-red-50');
  });

  it('should apply slide-up animation class', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: false,
      isSlowConnection: false,
      connectionType: undefined,
      effectiveType: undefined,
      downlink: undefined,
      rtt: undefined,
      saveData: false
    });

    render(<OfflineNotification />);
    
    const animatedDiv = document.querySelector('.animate-slide-up');
    expect(animatedDiv).toBeInTheDocument();
  });
});