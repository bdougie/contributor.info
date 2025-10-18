import { describe, it, expect } from 'vitest';
import { calculateTopicConfidence } from '../topic-clustering';

/**
 * Unit tests for topic-clustering pure functions
 * Following bulletproof testing guidelines - synchronous, pure functions only
 */

describe('Topic Clustering - Pure Functions', () => {
  describe('calculateTopicConfidence', () => {
    it('should return 1.0 for identical embeddings', () => {
      const embedding = [0.1, 0.2, 0.3, 0.4];
      const result = calculateTopicConfidence(embedding, embedding);
      expect(result).toBeCloseTo(1.0, 5);
    });

    it('should return lower confidence for dissimilar embeddings', () => {
      const embedding1 = [1.0, 0.0, 0.0, 0.0];
      const embedding2 = [0.0, 1.0, 0.0, 0.0];
      const result = calculateTopicConfidence(embedding1, embedding2);
      expect(result).toBeLessThanOrEqual(0.5);
    });

    it('should return value between 0 and 1', () => {
      const embedding1 = [0.5, 0.5, 0.0, 0.0];
      const embedding2 = [0.3, 0.7, 0.0, 0.0];
      const result = calculateTopicConfidence(embedding1, embedding2);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should handle 384-dimension embeddings', () => {
      const embedding1 = Array(384).fill(0.01);
      const embedding2 = Array(384).fill(0.01);
      const result = calculateTopicConfidence(embedding1, embedding2);
      expect(result).toBeCloseTo(1.0, 1);
    });

    it('should handle normalized embeddings', () => {
      const embedding1 = [0.6, 0.8]; // Magnitude = 1
      const embedding2 = [0.8, 0.6]; // Magnitude = 1
      const result = calculateTopicConfidence(embedding1, embedding2);
      expect(result).toBeGreaterThan(0.5);
    });
  });
});
