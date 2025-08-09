import React from 'react';
import { Search, Star, Clock, GitBranch, Loader2, Github } from '@/components/ui/icon';

// Simple test component to verify icons are loading
export default function TestIcons() {
  return (
    <div style={{ 
      padding: '20px', 
      display: 'grid', 
      gridTemplateColumns: 'repeat(3, 1fr)', 
      gap: '20px',
      background: '#fff',
      color: '#000'
    }}>
      <h1 style={{ gridColumn: '1/-1', textAlign: 'center' }}>Icon Loading Test</h1>
      
      <div style={{ textAlign: 'center' }}>
        <Search className="w-8 h-8" />
        <p>Search</p>
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <Star className="w-8 h-8" />
        <p>Star</p>
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <Clock className="w-8 h-8" />
        <p>Clock</p>
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <GitBranch className="w-8 h-8" />
        <p>Git Branch</p>
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <Loader2 className="w-8 h-8" />
        <p>Loader</p>
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <Github className="w-8 h-8" />
        <p>Github</p>
      </div>
    </div>
  );
}