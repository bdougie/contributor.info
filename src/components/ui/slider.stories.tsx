import type { Meta, StoryObj } from '@storybook/react';
import { Slider } from './slider';
import { useState } from 'react';
import { Label } from './label';

const meta = {
  title: 'UI/Forms/Slider',
  component: Slider,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'An input where the user selects a value from within a given range.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: [50],
    max: 100,
    step: 1,
  },
};

export const WithLabel: Story = {
  args: {},
  render: () => (
    <div className="space-y-3">
      <Label>Volume</Label>
      <Slider defaultValue={[75]} max={100} step={1} />
    </div>
  ),
};

export const Range: Story = {
  args: {},
  render: () => (
    <div className="space-y-3">
      <Label>Price Range</Label>
      <Slider defaultValue={[25, 75]} max={100} step={1} />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    defaultValue: [50],
    max: 100,
    step: 1,
    disabled: true,
  },
};

export const WithValue: Story = {
  args: {},
  render: () => {
    const ValueSlider = () => {
      const [value, setValue] = useState([50]);

      return (
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Brightness</Label>
            <span className="text-sm text-muted-foreground">{value[0]}%</span>
          </div>
          <Slider value={value} onValueChange={setValue} max={100} step={1} />
        </div>
      );
    };

    return <ValueSlider />;
  },
};

export const PriceRange: Story = {
  args: {},
  render: () => {
    const PriceSlider = () => {
      const [priceRange, setPriceRange] = useState([200, 800]);

      return (
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Price Range</Label>
            <span className="text-sm text-muted-foreground">
              ${priceRange[0]} - ${priceRange[1]}
            </span>
          </div>
          <Slider value={priceRange} onValueChange={setPriceRange} max={1000} min={0} step={10} />
        </div>
      );
    };

    return <PriceSlider />;
  },
};

export const Temperature: Story = {
  args: {},
  render: () => {
    const TempSlider = () => {
      const [temp, setTemp] = useState([20]);

      return (
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Temperature</Label>
            <span className="text-sm text-muted-foreground">{temp[0]}°C</span>
          </div>
          <Slider value={temp} onValueChange={setTemp} max={40} min={-10} step={1} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>-10°C</span>
            <span>40°C</span>
          </div>
        </div>
      );
    };

    return <TempSlider />;
  },
};

export const Multiple: Story = {
  args: {},
  render: () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Volume</Label>
        <Slider defaultValue={[75]} max={100} step={1} />
      </div>

      <div className="space-y-3">
        <Label>Bass</Label>
        <Slider defaultValue={[50]} max={100} step={1} />
      </div>

      <div className="space-y-3">
        <Label>Treble</Label>
        <Slider defaultValue={[60]} max={100} step={1} />
      </div>

      <div className="space-y-3">
        <Label>Balance</Label>
        <Slider defaultValue={[0]} max={10} min={-10} step={1} />
      </div>
    </div>
  ),
};

export const DifferentSteps: Story = {
  args: {},
  render: () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Step 1</Label>
          <span className="text-xs text-muted-foreground">Every 1 unit</span>
        </div>
        <Slider defaultValue={[25]} max={100} step={1} />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Step 5</Label>
          <span className="text-xs text-muted-foreground">Every 5 units</span>
        </div>
        <Slider defaultValue={[25]} max={100} step={5} />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Step 10</Label>
          <span className="text-xs text-muted-foreground">Every 10 units</span>
        </div>
        <Slider defaultValue={[20]} max={100} step={10} />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Step 25</Label>
          <span className="text-xs text-muted-foreground">Every 25 units</span>
        </div>
        <Slider defaultValue={[25]} max={100} step={25} />
      </div>
    </div>
  ),
};

export const CustomColors: Story = {
  args: {},
  render: () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Red Theme</Label>
        <Slider
          defaultValue={[50]}
          max={100}
          step={1}
          className="[&_[role=slider]]:bg-red-500 [&_[role=slider]]:border-red-500 [&>.bg-primary]:bg-red-500"
        />
      </div>

      <div className="space-y-3">
        <Label>Green Theme</Label>
        <Slider
          defaultValue={[70]}
          max={100}
          step={1}
          className="[&_[role=slider]]:bg-green-500 [&_[role=slider]]:border-green-500 [&>.bg-primary]:bg-green-500"
        />
      </div>

      <div className="space-y-3">
        <Label>Purple Theme</Label>
        <Slider
          defaultValue={[30]}
          max={100}
          step={1}
          className="[&_[role=slider]]:bg-purple-500 [&_[role=slider]]:border-purple-500 [&>.bg-primary]:bg-purple-500"
        />
      </div>
    </div>
  ),
};
