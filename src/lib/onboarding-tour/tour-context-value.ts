import { createContext } from 'react';
import type { TourContextValue } from './types';

export const TourContext = createContext<TourContextValue | null>(null);
