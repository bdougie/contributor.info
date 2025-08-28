import { describe, it, expect } from 'vitest';
import {
  getUserType,
  getPRState,
  getUserRole,
  getLastSyncDate,
  formatDateRange,
  getDubKeyStatus,
  findContributorInQuadrant,
  USER_TYPE_MAP,
  PR_STATE_MAP,
  ROLE_MAPPING,
  DATE_MAPPING,
  VALIDATION_MAP,
} from '../data-type-mapping';

describe('data-type-mapping utilities', () => {
  describe('USER_TYPE_MAP', () => {
    describe('fromBotFlag', () => {
      it('returns "Bot" for true', () => {
        expect(USER_TYPE_MAP.fromBotFlag(true)).toBe('Bot');
      });

      it('returns "User" for false', () => {
        expect(USER_TYPE_MAP.fromBotFlag(false)).toBe('User');
      });
    });

    describe('fromTypeString', () => {
      it('returns "Bot" when type is "Bot"', () => {
        expect(USER_TYPE_MAP.fromTypeString('Bot')).toBe('Bot');
      });

      it('returns "User" for any other type', () => {
        expect(USER_TYPE_MAP.fromTypeString('User')).toBe('User');
        expect(USER_TYPE_MAP.fromTypeString('Admin')).toBe('User');
        expect(USER_TYPE_MAP.fromTypeString(undefined)).toBe('User');
      });
    });
  });

  describe('getUserType', () => {
    it('returns "Bot" when contributor is_bot is true', () => {
      expect(getUserType({ is_bot: true })).toBe('Bot');
    });

    it('returns "User" when contributor is_bot is false', () => {
      expect(getUserType({ is_bot: false })).toBe('User');
    });

    it('returns "User" when contributor is undefined', () => {
      expect(getUserType(undefined)).toBe('User');
    });

    it('returns "User" when is_bot is undefined', () => {
      expect(getUserType({})).toBe('User');
    });
  });

  describe('getPRState', () => {
    it('returns "open" for "open" state', () => {
      expect(getPRState('open')).toBe('open');
    });

    it('returns "open" for "OPEN" state (case insensitive)', () => {
      expect(getPRState('OPEN')).toBe('open');
    });

    it('returns "closed" for "closed" state', () => {
      expect(getPRState('closed')).toBe('closed');
    });

    it('returns "closed" for any non-open state', () => {
      expect(getPRState('merged')).toBe('closed');
      expect(getPRState('draft')).toBe('closed');
    });

    it('returns "closed" for undefined/empty state', () => {
      expect(getPRState(undefined)).toBe('closed');
      expect(getPRState('')).toBe('closed');
    });
  });

  describe('getUserRole', () => {
    it('returns explicit role when provided', () => {
      expect(getUserRole({ role: 'Admin' }, { isBot: true })).toBe('Admin');
      expect(getUserRole({ role: 'Maintainer' }, { type: 'Bot' })).toBe('Maintainer');
    });

    it('returns "Bot" when user is a bot via isBot flag', () => {
      expect(getUserRole(undefined, { isBot: true })).toBe('Bot');
      expect(getUserRole({}, { isBot: true })).toBe('Bot');
    });

    it('returns "Bot" when user type is "Bot"', () => {
      expect(getUserRole(undefined, { type: 'Bot' })).toBe('Bot');
    });

    it('returns "Contributor" as default', () => {
      expect(getUserRole()).toBe('Contributor');
      expect(getUserRole({}, {})).toBe('Contributor');
      expect(getUserRole(undefined, { isBot: false })).toBe('Contributor');
    });

    it('prioritizes explicit role over bot detection', () => {
      expect(getUserRole({ role: 'Maintainer' }, { isBot: true, type: 'Bot' })).toBe('Maintainer');
    });
  });

  describe('DATE_MAPPING', () => {
    describe('fromTimestamp', () => {
      it('converts valid timestamp to Date', () => {
        const timestamp = '2023-12-01T12:00:00Z';
        const result = DATE_MAPPING.fromTimestamp(timestamp);
        expect(result).toBeInstanceOf(Date);
        expect(result?.toISOString()).toBe('2023-12-01T12:00:00.000Z');
      });

      it('returns undefined for null timestamp', () => {
        expect(DATE_MAPPING.fromTimestamp(null)).toBeUndefined();
      });

      it('returns undefined for undefined timestamp', () => {
        expect(DATE_MAPPING.fromTimestamp(undefined)).toBeUndefined();
      });
    });

    describe('formatRange', () => {
      it('formats date range with both dates', () => {
        const startDate = new Date('2023-01-01');
        const endDate = new Date('2023-12-31');
        const result = DATE_MAPPING.formatRange(startDate, endDate);
        expect(result).toBe('1/1/2023 - 12/31/2023');
      });

      it('uses "All time" for missing start date', () => {
        const endDate = new Date('2023-12-31');
        const result = DATE_MAPPING.formatRange(null, endDate);
        expect(result).toBe('All time - 12/31/2023');
      });

      it('uses "Present" for missing end date', () => {
        const startDate = new Date('2023-01-01');
        const result = DATE_MAPPING.formatRange(startDate, null);
        expect(result).toBe('1/1/2023 - Present');
      });

      it('handles both dates missing', () => {
        const result = DATE_MAPPING.formatRange(null, null);
        expect(result).toBe('All time - Present');
      });
    });
  });

  describe('getLastSyncDate', () => {
    it('returns Date object for valid timestamp', () => {
      const repo = { last_synced_at: '2023-12-01T12:00:00Z' };
      const result = getLastSyncDate(repo);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2023-12-01T12:00:00.000Z');
    });

    it('returns undefined for null timestamp', () => {
      const repo = { last_synced_at: null };
      expect(getLastSyncDate(repo)).toBeUndefined();
    });

    it('returns undefined for undefined repo', () => {
      expect(getLastSyncDate(undefined)).toBeUndefined();
    });

    it('returns undefined for repo without last_synced_at', () => {
      expect(getLastSyncDate({})).toBeUndefined();
    });
  });

  describe('formatDateRange', () => {
    it('formats date range with both dates', () => {
      const dateRange = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
      };
      const result = formatDateRange(dateRange);
      expect(result).toBe('1/1/2023 - 12/31/2023');
    });

    it('handles missing dateRange', () => {
      expect(formatDateRange(undefined)).toBe('All time - Present');
    });

    it('handles empty dateRange object', () => {
      expect(formatDateRange({})).toBe('All time - Present');
    });

    it('handles null dates in range', () => {
      const dateRange = {
        startDate: null,
        endDate: null,
      };
      expect(formatDateRange(dateRange)).toBe('All time - Present');
    });
  });

  describe('VALIDATION_MAP', () => {
    describe('dubKey', () => {
      it('validates DUB.CO keys correctly', () => {
        expect(VALIDATION_MAP.dubKey.isValid('dub_12345')).toBe(true);
        expect(VALIDATION_MAP.dubKey.isValid('invalid_key')).toBe(false);
        expect(VALIDATION_MAP.dubKey.isValid(undefined)).toBe(false);
      });

      it('returns correct status strings', () => {
        expect(VALIDATION_MAP.dubKey.getStatus('dub_12345')).toBe('✅ Valid');
        expect(VALIDATION_MAP.dubKey.getStatus('invalid_key')).toBe('❌ Invalid');
        expect(VALIDATION_MAP.dubKey.getStatus(undefined)).toBe('❌ Invalid');
      });
    });
  });

  describe('getDubKeyStatus', () => {
    it('returns valid status for correct DUB key', () => {
      expect(getDubKeyStatus('dub_abcdef123456')).toBe('✅ Valid');
    });

    it('returns invalid status for incorrect key', () => {
      expect(getDubKeyStatus('invalid_key')).toBe('❌ Invalid');
      expect(getDubKeyStatus('')).toBe('❌ Invalid');
      expect(getDubKeyStatus(undefined)).toBe('❌ Invalid');
    });

    it('returns invalid status for keys not starting with "dub_"', () => {
      expect(getDubKeyStatus('api_key_123')).toBe('❌ Invalid');
      expect(getDubKeyStatus('123dub_')).toBe('❌ Invalid');
    });
  });

  describe('findContributorInQuadrant', () => {
    it('finds contributor by ID in quadrant children', () => {
      const quadrant = {
        children: [
          { id: 'user1', name: 'Alice' },
          { id: 'user2', name: 'Bob' },
          { id: 'user3', name: 'Charlie' },
        ],
      };
      
      const result = findContributorInQuadrant(quadrant, 'user2');
      expect(result).toEqual({ id: 'user2', name: 'Bob' });
    });

    it('returns undefined when contributor not found', () => {
      const quadrant = {
        children: [
          { id: 'user1', name: 'Alice' },
          { id: 'user2', name: 'Bob' },
        ],
      };
      
      expect(findContributorInQuadrant(quadrant, 'user3')).toBeUndefined();
    });

    it('returns undefined when quadrant is undefined', () => {
      expect(findContributorInQuadrant(undefined, 'user1')).toBeUndefined();
    });

    it('returns undefined when children array is undefined', () => {
      const quadrant = {};
      expect(findContributorInQuadrant(quadrant, 'user1')).toBeUndefined();
    });

    it('returns undefined when selectedContributor is undefined', () => {
      const quadrant = {
        children: [{ id: 'user1', name: 'Alice' }],
      };
      expect(findContributorInQuadrant(quadrant, undefined)).toBeUndefined();
    });

    it('returns undefined when children array is empty', () => {
      const quadrant = { children: [] };
      expect(findContributorInQuadrant(quadrant, 'user1')).toBeUndefined();
    });
  });

  describe('constants', () => {
    it('has correct PR_STATE_MAP values', () => {
      expect(PR_STATE_MAP.open).toBe('open');
      expect(PR_STATE_MAP.closed).toBe('closed');
    });

    it('has correct ROLE_MAPPING values', () => {
      expect(ROLE_MAPPING.bot).toBe('Bot');
      expect(ROLE_MAPPING.contributor).toBe('Contributor');
    });
  });
});