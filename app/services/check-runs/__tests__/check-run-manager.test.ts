import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckRunManager } from '../check-run-manager';
import type { Octokit } from '@octokit/rest';

describe('CheckRunManager', () => {
  let checkRunManager: CheckRunManager;
  let mockOctokit: Partial<Octokit>;

  beforeEach(() => {
    // Mock Octokit
    mockOctokit = {
      rest: {
        checks: {
          create: vi.fn().mockResolvedValue({
            data: { id: 12345 },
          }),
          update: vi.fn().mockResolvedValue({
            data: { id: 12345 },
          }),
        },
      } as Partial<Octokit['rest']>,
    } as Partial<Octokit>;

    checkRunManager = new CheckRunManager(
      mockOctokit as Octokit,
      'test-owner',
      'test-repo',
      '123abc'
    );

    // Spy on console methods instead of overwriting to allow restoration
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('create', () => {
    it('should create a new check run', async () => {
      const checkRunId = await checkRunManager.create({
        name: 'Test Check',
        head_sha: '123abc',
        status: 'in_progress',
      });

      expect(checkRunId).toBe(12345);
      expect(mockOctokit.rest?.checks.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        name: 'Test Check',
        head_sha: '123abc',
        status: 'in_progress',
      });
    });

    it('should handle creation errors gracefully', async () => {
      (mockOctokit.rest?.checks.create as ReturnType<typeof vi.fn>)?.mockRejectedValue(
        new Error('API Error')
      );

      await expect(
        checkRunManager.create({
          name: 'Test Check',
          head_sha: '123abc',
          status: 'in_progress',
        })
      ).rejects.toThrow('API Error');
    });
  });

  describe('update', () => {
    it('should update an existing check run', async () => {
      await checkRunManager.update(12345, {
        status: 'completed',
        conclusion: 'success',
      });

      expect(mockOctokit.rest?.checks.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        check_run_id: 12345,
        status: 'completed',
        conclusion: 'success',
        completed_at: undefined,
        output: undefined,
      });
    });

    it('should handle output with annotations safely', async () => {
      await checkRunManager.update(12345, {
        status: 'completed',
        conclusion: 'success',
        output: {
          title: 'Test Output',
          summary: 'Test Summary',
          text: 'Test Text',
          annotations: [
            {
              path: 'test.ts',
              start_line: 1,
              end_line: 1,
              annotation_level: 'notice' as const,
              message: 'Test annotation',
            },
          ],
        },
      });

      expect(mockOctokit.rest?.checks.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        check_run_id: 12345,
        status: 'completed',
        conclusion: 'success',
        completed_at: undefined,
        output: {
          title: 'Test Output',
          summary: 'Test Summary',
          text: 'Test Text',
          annotations: [
            {
              path: 'test.ts',
              start_line: 1,
              end_line: 1,
              annotation_level: 'notice',
              message: 'Test annotation',
            },
          ],
        },
      });
    });

    it('should handle undefined annotations gracefully', async () => {
      await checkRunManager.update(12345, {
        status: 'completed',
        conclusion: 'success',
        output: {
          title: 'Test Output',
          summary: 'Test Summary',
          text: 'Test Text',
          annotations: undefined,
        },
      });

      expect(mockOctokit.rest?.checks.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        check_run_id: 12345,
        status: 'completed',
        conclusion: 'success',
        completed_at: undefined,
        output: {
          title: 'Test Output',
          summary: 'Test Summary',
          text: 'Test Text',
          annotations: undefined,
        },
      });
    });

    it('should handle null annotations gracefully', async () => {
      await checkRunManager.update(12345, {
        status: 'completed',
        conclusion: 'success',
        output: {
          title: 'Test Output',
          summary: 'Test Summary',
          text: 'Test Text',
          annotations: null as unknown as undefined,
        },
      });

      const call = (mockOctokit.rest?.checks.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.output.annotations).toBeUndefined();
    });

    it('should limit annotations to 50', async () => {
      const manyAnnotations = Array.from({ length: 100 }, (_, i) => ({
        path: `test${i}.ts`,
        start_line: 1,
        end_line: 1,
        annotation_level: 'notice' as const,
        message: `Annotation ${i}`,
      }));

      await checkRunManager.update(12345, {
        status: 'completed',
        conclusion: 'success',
        output: {
          title: 'Test Output',
          summary: 'Test Summary',
          text: 'Test Text',
          annotations: manyAnnotations,
        },
      });

      const call = (mockOctokit.rest?.checks.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.output.annotations).toHaveLength(50);
    });

    it('should handle update errors gracefully', async () => {
      (mockOctokit.rest?.checks.update as ReturnType<typeof vi.fn>)?.mockRejectedValue(
        new Error('API Error')
      );

      await expect(
        checkRunManager.update(12345, {
          status: 'completed',
          conclusion: 'success',
        })
      ).rejects.toThrow('API Error');
    });
  });

  describe('complete', () => {
    it('should complete a check run with success', async () => {
      await checkRunManager.complete(12345, 'success', 'All checks passed');

      expect(mockOctokit.rest?.checks.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        check_run_id: 12345,
        status: 'completed',
        conclusion: 'success',
        completed_at: expect.any(String),
        output: {
          title: 'Check Complete',
          summary: 'All checks passed',
          text: undefined,
          annotations: undefined,
        },
      });
    });

    it('should complete a check run with failure', async () => {
      await checkRunManager.complete(12345, 'failure', 'Some checks failed');

      expect(mockOctokit.rest?.checks.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        check_run_id: 12345,
        status: 'completed',
        conclusion: 'failure',
        completed_at: expect.any(String),
        output: {
          title: 'Check Complete',
          summary: 'Some checks failed',
          text: undefined,
          annotations: undefined,
        },
      });
    });
  });

  describe('fail', () => {
    it('should fail a check run with an error message', async () => {
      await checkRunManager.fail(12345, 'Test error occurred');

      expect(mockOctokit.rest?.checks.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        check_run_id: 12345,
        status: 'completed',
        conclusion: 'failure',
        completed_at: expect.any(String),
        output: {
          title: 'Check Failed',
          summary: 'Test error occurred',
          text: undefined,
          annotations: undefined,
        },
      });
    });
  });
});
