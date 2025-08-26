import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { designTokens } from '../../../.storybook/design-tokens';
import { Textarea } from './textarea';
import { Label } from './label';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './card';

const meta = {
  title: 'UI/Forms/Textarea',
  component: Textarea,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A versatile textarea component with auto-resize capabilities, character counting, validation states, and accessibility features.',
      },
    },
  },
  tags: ['autodocs', 'interaction', 'accessibility'],
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder text for the textarea',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the textarea is disabled',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
    readOnly: {
      control: 'boolean',
      description: 'Whether the textarea is read-only',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
    required: {
      control: 'boolean',
      description: 'Whether the textarea is required',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
    rows: {
      control: 'number',
      description: 'Number of visible text lines',
      table: {
        defaultValue: { summary: '3' },
      },
    },
    maxLength: {
      control: 'number',
      description: 'Maximum character length',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ 
        minWidth: '400px',
        padding: designTokens.spacing[4],
      }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Type your message here.',
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: 'This is a textarea with some initial content that demonstrates how text wraps naturally within the component.',
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'This textarea is disabled.',
    disabled: true,
  },
};

export const ReadOnly: Story = {
  args: {
    value: 'This content is read-only and cannot be edited by the user.',
    readOnly: true,
  },
};

export const Required: Story = {
  args: {
    placeholder: 'This field is required...',
    required: true,
  },
};

export const WithRows: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[3] }}>
      <div>
        <Label>2 Rows (Compact)</Label>
        <Textarea placeholder="Compact textarea..." rows={2} />
      </div>
      <div>
        <Label>4 Rows (Default)</Label>
        <Textarea placeholder="Default size textarea..." rows={4} />
      </div>
      <div>
        <Label>8 Rows (Large)</Label>
        <Textarea placeholder="Large textarea for longer content..." rows={8} />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Textareas with different row counts for various content lengths.',
      },
    },
  },
};

export const WithMaxLength: Story = {
  args: {
    placeholder: 'Max 100 characters...',
    maxLength: 100,
  },
};

export const ValidationStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[4] }}>
      <div>
        <Label htmlFor="valid">Valid Input</Label>
        <Textarea 
          id="valid" 
          defaultValue="This content meets all requirements."
          className="border-green-500 focus:ring-green-500"
          aria-invalid="false"
        />
        <p className="text-sm text-green-600 mt-1">✓ Looks good!</p>
      </div>
      
      <div>
        <Label htmlFor="invalid">Invalid Input</Label>
        <Textarea 
          id="invalid" 
          defaultValue="Too short"
          className="border-red-500 focus:ring-red-500"
          aria-invalid="true"
          aria-describedby="invalid-error"
        />
        <p id="invalid-error" className="text-sm text-red-600 mt-1">Message must be at least 20 characters</p>
      </div>
      
      <div>
        <Label htmlFor="warning">Warning State</Label>
        <Textarea 
          id="warning" 
          defaultValue="This message might be too informal for a professional context."
          className="border-amber-500 focus:ring-amber-500"
        />
        <p className="text-sm text-amber-600 mt-1">⚠ Consider using more formal language</p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different validation states with visual feedback and ARIA attributes.',
      },
    },
  },
};

export const AutoResize: Story = {
  render: () => {
    const AutoResizeExample = () => {
      const [value, setValue] = useState('');
      const textareaRef = useRef<HTMLTextAreaElement>(null);

      useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        }
      }, [value]);

      return (
        <div className="space-y-2">
          <Label htmlFor="auto-resize">Auto-resizing Textarea</Label>
          <Textarea
            ref={textareaRef}
            id="auto-resize"
            placeholder="Start typing and watch me grow..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="resize-none overflow-hidden"
            rows={1}
          />
          <p className="text-sm text-muted-foreground">
            This textarea automatically expands as you type.
          </p>
        </div>
      );
    };
    return <AutoResizeExample />;
  },
  parameters: {
    docs: {
      description: {
        story: 'A textarea that automatically adjusts its height based on content.',
      },
    },
  },
};

export const WithCharacterCount: Story = {
  render: () => {
    const CharacterCountExample = () => {
      const [value, setValue] = useState('');
      const maxLength = 280;
      const remaining = maxLength - value.length;
      const percentage = (value.length / maxLength) * 100;
      
      return (
        <div className="space-y-2">
          <Label htmlFor="limited">Tweet-style Message</Label>
          <Textarea
            id="limited"
            placeholder="What's on your mind?"
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
            rows={3}
            aria-describedby="char-count"
          />
          <div className="flex justify-between items-center">
            <div className="h-1 flex-1 bg-gray-200 rounded mr-3">
              <div 
                className={`h-full rounded transition-all ${
                  percentage > 90
? 'bg-red-500' : 
                  percentage > 75 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <p 
              id="char-count"
              className={`text-sm font-medium ${
                remaining < 20
? 'text-red-600' : 
                remaining < 50 ? 'text-amber-600' : 'text-gray-600'
              }`}
            >
              {remaining}
            </p>
          </div>
        </div>
      );
    };
    return <CharacterCountExample />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Textarea with character counter and visual progress indicator.',
      },
    },
  },
};

export const WithMentions: Story = {
  render: () => {
    const MentionsExample = () => {
      const [value, setValue] = useState('');
      const [showSuggestions, setShowSuggestions] = useState(false);
      const suggestions = ['@john_doe', '@jane_smith', '@team_lead', '@product_manager'];

      const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setValue(text);
        
        // Check if user is typing a mention
        const lastWord = text.split(' ').pop() || '';
        setShowSuggestions(lastWord.startsWith('@') && lastWord.length > 1);
      };

      return (
        <div className="space-y-2 relative">
          <Label htmlFor="mentions">Comment</Label>
          <Textarea
            id="mentions"
            placeholder="Type @ to mention someone..."
            value={value}
            onChange={handleChange}
            rows={4}
          />
          {showSuggestions && (
            <div className="absolute mt-1 p-2 bg-white border rounded-md shadow-lg z-10">
              <p className="text-sm font-medium mb-1">Suggestions:</p>
              {suggestions.map(user => (
                <button
                  key={user}
                  className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded"
                  onClick={() => {
                    const words = value.split(' ');
                    words[words.length - 1] = user;
                    setValue(words.join(' ') + ' ');
                    setShowSuggestions(false);
                  }}
                >
                  {user}
                </button>
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            You can @mention other users and organizations.
          </p>
        </div>
      );
    };
    return <MentionsExample />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Textarea with @mention functionality and suggestions.',
      },
    },
  },
};

export const MarkdownEditor: Story = {
  render: () => {
    const MarkdownExample = () => {
      const [value, setValue] = useState('# Hello World\n\nType **bold** or *italic* text.');
      const [preview, setPreview] = useState(false);

      return (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Markdown Editor</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreview(!preview)}
              >
                {preview ? 'Edit' : 'Preview'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {preview
? (
              <div className="prose prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ 
                  __html: value
                    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                    .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*)\*/g, '<em>$1</em>')
                    .replace(/\n/g, '<br />')
                }} />
              </div>
            )
: (
              <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Write your markdown here..."
                rows={10}
                className="font-mono text-sm"
              />
            )}
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              Supports basic markdown: # headers, **bold**, *italic*
            </p>
          </CardFooter>
        </Card>
      );
    };
    return <MarkdownExample />;
  },
  parameters: {
    docs: {
      description: {
        story: 'A simple markdown editor with preview functionality.',
      },
    },
  },
};

export const Interactive: Story = {
  render: () => {
    const InteractiveExample = () => {
      const [value, setValue] = useState('');
      const [errors, setErrors] = useState<string[]>([]);
      const minLength = 10;
      const maxLength = 500;

      const validate = (text: string) => {
        const newErrors = [];
        if (text.length > 0 && text.length < minLength) {
          newErrors.push(`Minimum ${minLength} characters required`);
        }
        if (text.split(' ').length < 3 && text.length > 0) {
          newErrors.push('Please write at least 3 words');
        }
        if (/[<>]/g.test(text)) {
          newErrors.push('HTML tags are not allowed');
        }
        setErrors(newErrors);
      };

      return (
        <div className="space-y-2">
          <Label htmlFor="interactive">Description</Label>
          <Textarea
            id="interactive"
            placeholder="Describe your project (min 10 chars)..."
            value={value}
            onChange={(e) => {
              const newValue = e.target.value.slice(0, maxLength);
              setValue(newValue);
              validate(newValue);
            }}
            rows={4}
            className={
              errors.length > 0
? 'border-red-500' : 
              value.length >= minLength ? 'border-green-500' : ''
            }
            aria-invalid={errors.length > 0}
            aria-describedby={errors.length > 0 ? 'interactive-errors' : undefined}
          />
          
          {errors.length > 0 && (
            <ul id="interactive-errors" className="text-sm text-red-600">
              {errors.map((__error, i) => (
                <li key={i}>• {error: _error}</li>
              ))}
            </ul>
          )}
          
          {errors.length === 0 && value.length >= minLength && (
            <p className="text-sm text-green-600">✓ Description is valid</p>
          )}
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>Words: {value.split(' ').filter(w => w).length}</span>
            <span>{value.length}/{maxLength}</span>
          </div>
        </div>
      );
    };
    return <InteractiveExample />;
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText('Description');

    // Test initial state
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('');

    // Test typing
    

    // Type valid content
    
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive textarea with real-time validation and word counting.',
      },
    },
  },
};

export const FormExample: Story = {
  render: () => (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Contact Form</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <div>
            <Label htmlFor="subject">Subject *</Label>
            <Textarea
              id="subject"
              placeholder="Brief description of your inquiry..."
              rows={2}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder="Please provide details about your request..."
              rows={6}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="additional">Additional Information</Label>
            <Textarea
              id="additional"
              placeholder="Any other relevant details (optional)..."
              rows={3}
            />
          </div>
          
          <Button type="submit" className="w-full">Send Message</Button>
        </form>
      </CardContent>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Complete form example with multiple textareas.',
      },
    },
  },
};

export const KeyboardNavigation: Story = {
  render: () => (
    <form className="space-y-3">
      <Textarea placeholder="Press Tab to navigate" rows={2} />
      <Textarea placeholder="Tab to this field" rows={2} />
      <Textarea placeholder="Tab to final field" rows={2} />
      <Button type="submit">Submit (Tab here)</Button>
    </form>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textareas = canvas.getAllByRole('textbox');
    
    // Focus first textarea
    textareas[0].focus();
    expect(document.activeElement).toBe(textareas[0]);
    
    // Simulate Tab key to next field
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    document.dispatchEvent(tabEvent);
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates keyboard navigation between textareas.',
      },
    },
  },
  tags: ['interaction', 'accessibility'],
};

export const MobileOptimized: Story = {
  render: () => (
    <div className="space-y-3">
      <div>
        <Label htmlFor="mobile-comment">Comment</Label>
        <Textarea 
          id="mobile-comment" 
          placeholder="Share your thoughts..."
          className="touch-manipulation"
          rows={3}
        />
      </div>
      
      <div>
        <Label htmlFor="mobile-feedback">Quick Feedback</Label>
        <Textarea 
          id="mobile-feedback" 
          placeholder="Tap to start typing..."
          className="touch-manipulation text-base"
          rows={2}
        />
      </div>
      
      <p className="text-sm text-muted-foreground">
        Optimized for mobile with larger touch targets and appropriate font sizes.
      </p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Textareas optimized for mobile devices with touch-friendly sizing.',
      },
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(2, 1fr)', 
      gap: designTokens.spacing[4],
    }}>
      <div>
        <Label>Default</Label>
        <Textarea placeholder="Default textarea" />
      </div>
      
      <div>
        <Label>With Value</Label>
        <Textarea defaultValue="Pre-filled content" />
      </div>
      
      <div>
        <Label>Disabled</Label>
        <Textarea placeholder="Disabled" disabled />
      </div>
      
      <div>
        <Label>Read-only</Label>
        <Textarea value="Read-only content" readOnly />
      </div>
      
      <div>
        <Label>Required</Label>
        <Textarea placeholder="Required field" required />
      </div>
      
      <div>
        <Label>With Max Length</Label>
        <Textarea placeholder="Max 50 chars" maxLength={50} />
      </div>
      
      <div>
        <Label>Small (2 rows)</Label>
        <Textarea placeholder="Compact" rows={2} />
      </div>
      
      <div>
        <Label>Large (6 rows)</Label>
        <Textarea placeholder="Expanded" rows={6} />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All textarea variants and states in one view.',
      },
    },
  },
};