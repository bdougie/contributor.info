import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { designTokens } from '../../../.storybook/design-tokens';
import { Checkbox } from './checkbox';
import { Label } from './label';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

const meta = {
  title: 'UI/Forms/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A checkbox component for multiple selections. Built on Radix UI with indeterminate state support, keyboard navigation, and full accessibility.',
      },
    },
  },
  tags: ['autodocs', 'interaction', 'accessibility'],
  argTypes: {
    checked: {
      control: 'select',
      options: [true, false, 'indeterminate'],
      description: 'The controlled checked state of the checkbox',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
    defaultChecked: {
      control: 'boolean',
      description: 'The default checked state (uncontrolled)',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the checkbox is disabled',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
    required: {
      control: 'boolean',
      description: 'Whether the checkbox is required',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
    name: {
      control: 'text',
      description: 'The name of the checkbox for form submission',
    },
    value: {
      control: 'text',
      description: 'The value of the checkbox for form submission',
      table: {
        defaultValue: { summary: 'on' },
      },
    },
    onCheckedChange: {
      action: 'checked changed',
      description: 'Callback when the checked state changes',
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          minWidth: '300px',
          padding: designTokens.spacing[4],
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    defaultChecked: true,
  },
};

export const Indeterminate: Story = {
  render: () => {
    const IndeterminateExample = () => {
      const [checked, setChecked] = useState<boolean | 'indeterminate'>('indeterminate');

      return (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox id="parent" checked={checked} onCheckedChange={setChecked} />
            <Label htmlFor="parent">Select All</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            State:{' '}
            {checked === 'indeterminate'
              ? 'Partially selected'
              : checked
                ? 'All selected'
                : 'None selected'}
          </p>
        </div>
      );
    };
    return <IndeterminateExample />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Checkbox with indeterminate state for partial selections.',
      },
    },
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" />
      <Label
        htmlFor="terms"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Accept terms and conditions
      </Label>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[4] }}>
      <div className="flex items-center space-x-2">
        <Checkbox id="small" className="h-3 w-3" />
        <Label htmlFor="small">Small (12px)</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox id="default" />
        <Label htmlFor="default">Default (16px)</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox id="large" className="h-5 w-5" />
        <Label htmlFor="large">Large (20px)</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox id="xlarge" className="h-6 w-6" />
        <Label htmlFor="xlarge">Extra Large (24px)</Label>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Checkboxes in different sizes for various use cases.',
      },
    },
  },
};

export const States: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: designTokens.spacing[4],
      }}
    >
      <div>
        <Label className="text-sm font-medium mb-2 block">Unchecked</Label>
        <Checkbox />
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Checked</Label>
        <Checkbox defaultChecked />
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Indeterminate</Label>
        <Checkbox checked="indeterminate" />
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Disabled</Label>
        <Checkbox disabled />
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Disabled Checked</Label>
        <Checkbox disabled defaultChecked />
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Required</Label>
        <div>
          <Checkbox required />
          <span className="text-red-500 ml-1">*</span>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All checkbox states including indeterminate for partial selections.',
      },
    },
  },
};

export const WithDescription: Story = {
  render: () => (
    <div className="items-top flex space-x-2">
      <Checkbox id="terms2" />
      <div className="grid gap-1.5 leading-none">
        <Label
          htmlFor="terms2"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Accept terms and conditions
        </Label>
        <p className="text-sm text-muted-foreground">
          You agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  ),
};

export const CheckboxGroup: Story = {
  render: () => {
    const CheckboxGroupExample = () => {
      const [selected, setSelected] = useState<string[]>(['notifications']);

      const handleCheckChange = (value: string, checked: boolean | 'indeterminate') => {
        if (checked === true) {
          setSelected([...selected, value]);
        } else {
          setSelected(selected.filter((item) => item !== value));
        }
      };

      return (
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Select your interests</Label>
            <p className="text-sm text-muted-foreground mb-3">Choose all that apply</p>
          </div>

          <div className="space-y-3">
            {[
              { id: 'design', label: 'Design', description: 'UI/UX and visual design' },
              {
                id: 'development',
                label: 'Development',
                description: 'Frontend and backend coding',
              },
              { id: 'marketing', label: 'Marketing', description: 'Growth and promotion' },
              { id: 'sales', label: 'Sales', description: 'Business development' },
            ].map((item) => (
              <div key={item.id} className="flex items-start space-x-2">
                <Checkbox
                  id={item.id}
                  checked={selected.includes(item.id)}
                  onCheckedChange={(checked) => handleCheckChange(item.id, checked)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor={item.id} className="text-sm font-medium">
                    {item.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <p className="text-sm text-muted-foreground">
              Selected: {selected.length > 0 ? selected.join(', ') : 'None'}
            </p>
          </div>
        </div>
      );
    };
    return <CheckboxGroupExample />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Group of checkboxes with descriptions and state management.',
      },
    },
  },
};

export const SelectAllPattern: Story = {
  render: () => {
    const SelectAllExample = () => {
      const items = ['Email', 'SMS', 'Push', 'In-app'];
      const [checkedItems, setCheckedItems] = useState<string[]>(['Email']);

      const allChecked = checkedItems.length === items.length;
      const indeterminate = checkedItems.length > 0 && checkedItems.length < items.length;

      const handleSelectAll = (checked: boolean | 'indeterminate') => {
        if (checked === true) {
          setCheckedItems(items);
        } else {
          setCheckedItems([]);
        }
      };

      const handleItemCheck = (item: string, checked: boolean | 'indeterminate') => {
        if (checked === true) {
          setCheckedItems([...checkedItems, item]);
        } else {
          setCheckedItems(checkedItems.filter((i) => i !== item));
        }
      };

      return (
        <Card>
          <CardHeader>
            <CardTitle>Notification Channels</CardTitle>
            <CardDescription>Select how you want to receive notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b">
              <Checkbox
                id="select-all"
                checked={allChecked ? true : indeterminate ? 'indeterminate' : false}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="font-medium">
                Select All
              </Label>
            </div>

            <div className="space-y-3 pl-6">
              {items.map((item) => (
                <div key={item} className="flex items-center space-x-2">
                  <Checkbox
                    id={item}
                    checked={checkedItems.includes(item)}
                    onCheckedChange={(checked) => handleItemCheck(item, checked)}
                  />
                  <Label htmlFor={item} className="text-sm font-normal">
                    {item} notifications
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    };
    return <SelectAllExample />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Select all pattern with indeterminate state for parent checkbox.',
      },
    },
  },
};

export const Interactive: Story = {
  render: () => {
    const InteractiveExample = () => {
      const [agreed, setAgreed] = useState(false);
      const [subscribed, setSubscribed] = useState(false);
      const [canSubmit, setCanSubmit] = useState(false);

      useEffect(() => {
        setCanSubmit(agreed);
      }, [agreed]);

      return (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="agreement"
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked === true)}
                  required
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="agreement" className="text-sm font-medium">
                    Terms of Service <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    I agree to the terms of service and privacy policy
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="newsletter"
                  checked={subscribed}
                  onCheckedChange={(checked) => setSubscribed(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="newsletter" className="text-sm font-medium">
                    Newsletter (Optional)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive updates about new features and tips
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button disabled={!canSubmit} className="w-full">
            {canSubmit ? 'Continue' : 'Please accept terms to continue'}
          </Button>

          <div className="text-sm text-muted-foreground">
            <p>✓ Terms accepted: {agreed ? 'Yes' : 'No'}</p>
            <p>✓ Newsletter: {subscribed ? 'Subscribed' : 'Not subscribed'}</p>
          </div>
        </div>
      );
    };
    return <InteractiveExample />;
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const termsCheckbox = canvas.getByRole('checkbox', { name: /terms of service/i });
    const newsletterCheckbox = canvas.getByRole('checkbox', { name: /newsletter/i });
    const button = canvas.getByRole('button');

    // Initially button should be disabled
    expect(button).toBeDisabled();

    // Check terms checkbox
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive checkboxes with form validation and submit button state.',
      },
    },
  },
};

export const ValidationStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[4] }}>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="valid"
          defaultChecked
          className="border-green-500 data-[state=checked]:bg-green-500"
        />
        <Label htmlFor="valid">Valid selection</Label>
        <span className="text-sm text-green-600">✓</span>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox id="invalid" className="border-red-500" />
        <Label htmlFor="invalid">Required field</Label>
        <span className="text-sm text-red-600">Required</span>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="warning"
          defaultChecked
          className="border-amber-500 data-[state=checked]:bg-amber-500"
        />
        <Label htmlFor="warning">Optional but recommended</Label>
        <span className="text-sm text-amber-600">!</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Checkboxes with different validation states and visual feedback.',
      },
    },
  },
};

export const TableSelection: Story = {
  render: () => {
    const TableExample = () => {
      const rows = [
        { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User' },
        { id: 4, name: 'Alice Brown', email: 'alice@example.com', role: 'Moderator' },
      ];

      const [selectedRows, setSelectedRows] = useState<number[]>([]);

      const allSelected = selectedRows.length === rows.length;
      const someSelected = selectedRows.length > 0 && selectedRows.length < rows.length;

      const handleSelectAll = (checked: boolean | 'indeterminate') => {
        if (checked === true) {
          setSelectedRows(rows.map((r) => r.id));
        } else {
          setSelectedRows([]);
        }
      };

      const handleRowSelect = (id: number, checked: boolean | 'indeterminate') => {
        if (checked === true) {
          setSelectedRows([...selectedRows, id]);
        } else {
          setSelectedRows(selectedRows.filter((rowId) => rowId !== id));
        }
      };

      return (
        <div className="space-y-2">
          <table className="w-full border">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all rows"
                  />
                </th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Role</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={selectedRows.includes(row.id) ? 'bg-muted/50' : ''}>
                  <td className="p-2">
                    <Checkbox
                      checked={selectedRows.includes(row.id)}
                      onCheckedChange={(checked) => handleRowSelect(row.id, checked)}
                      aria-label={`Select ${row.name}`}
                    />
                  </td>
                  <td className="p-2">{row.name}</td>
                  <td className="p-2">{row.email}</td>
                  <td className="p-2">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-sm text-muted-foreground">
            {selectedRows.length} of {rows.length} rows selected
          </p>
        </div>
      );
    };
    return <TableExample />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Checkbox selection pattern for data tables.',
      },
    },
  },
};

export const KeyboardNavigation: Story = {
  render: () => (
    <form className="space-y-3">
      <div className="flex items-center space-x-2">
        <Checkbox id="kb1" />
        <Label htmlFor="kb1">First option (Tab to focus)</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox id="kb2" />
        <Label htmlFor="kb2">Second option (Space to check)</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox id="kb3" />
        <Label htmlFor="kb3">Third option</Label>
      </div>

      <Button type="submit">Submit</Button>
    </form>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkboxes = canvas.getAllByRole('checkbox');

    // Focus first checkbox
    checkboxes[0].focus();
    expect(document.activeElement).toBe(checkboxes[0]);

    // Simulate Space key to check
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
    checkboxes[0].dispatchEvent(spaceEvent);

    // Tab to next checkbox
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    document.dispatchEvent(tabEvent);
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates keyboard navigation with Tab and Space keys.',
      },
    },
  },
  tags: ['interaction', 'accessibility'],
};

export const MobileOptimized: Story = {
  render: () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Privacy Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { id: 'location', label: 'Location Services', desc: 'Allow apps to use your location' },
            { id: 'camera', label: 'Camera Access', desc: 'Allow apps to use your camera' },
            { id: 'contacts', label: 'Contacts', desc: 'Allow apps to access contacts' },
            { id: 'photos', label: 'Photos', desc: 'Allow apps to access photos' },
          ].map((item) => (
            <div key={item.id} className="flex items-start space-x-3 py-2">
              <Checkbox id={item.id} className="h-5 w-5 mt-1 touch-manipulation" />
              <div className="flex-1">
                <Label htmlFor={item.id} className="text-base font-medium">
                  {item.label}
                </Label>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground text-center">
        Optimized for touch with larger tap targets
      </p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Mobile-optimized checkboxes with larger touch targets.',
      },
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const AllVariants: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: designTokens.spacing[4],
      }}
    >
      <div className="text-center">
        <Label className="text-xs mb-2 block">Default</Label>
        <Checkbox />
      </div>

      <div className="text-center">
        <Label className="text-xs mb-2 block">Checked</Label>
        <Checkbox defaultChecked />
      </div>

      <div className="text-center">
        <Label className="text-xs mb-2 block">Indeterminate</Label>
        <Checkbox checked="indeterminate" />
      </div>

      <div className="text-center">
        <Label className="text-xs mb-2 block">Disabled</Label>
        <Checkbox disabled />
      </div>

      <div className="text-center">
        <Label className="text-xs mb-2 block">Disabled Checked</Label>
        <Checkbox disabled defaultChecked />
      </div>

      <div className="text-center">
        <Label className="text-xs mb-2 block">Small</Label>
        <Checkbox className="h-3 w-3" />
      </div>

      <div className="text-center">
        <Label className="text-xs mb-2 block">Large</Label>
        <Checkbox className="h-5 w-5" />
      </div>

      <div className="text-center">
        <Label className="text-xs mb-2 block">Required</Label>
        <div>
          <Checkbox required />
          <span className="text-red-500 ml-1">*</span>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All checkbox variants and states in one view.',
      },
    },
  },
};
