import type { Meta, StoryObj } from '@storybook/react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './table';
import { Badge } from './badge';
import { Button } from './button';

const meta = {
  title: 'UI/DataDisplay/Table',
  component: Table,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A responsive table component for displaying tabular data.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[800px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const invoices = [
  {
    id: "INV001",
    paymentStatus: "Paid",
    totalAmount: "$250.00",
    paymentMethod: "Credit Card",
  },
  {
    id: "INV002",
    paymentStatus: "Pending",
    totalAmount: "$150.00",
    paymentMethod: "PayPal",
  },
  {
    id: "INV003",
    paymentStatus: "Unpaid",
    totalAmount: "$350.00",
    paymentMethod: "Bank Transfer",
  },
  {
    id: "INV004",
    paymentStatus: "Paid",
    totalAmount: "$450.00",
    paymentMethod: "Credit Card",
  },
  {
    id: "INV005",
    paymentStatus: "Paid",
    totalAmount: "$550.00",
    paymentMethod: "PayPal",
  },
];

export const Default: Story = {
  args: {},
  render: () => (
    <Table>
      <TableCaption>A list of your recent invoices.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell className="font-medium">{invoice.id}</TableCell>
            <TableCell>{invoice.paymentStatus}</TableCell>
            <TableCell>{invoice.paymentMethod}</TableCell>
            <TableCell className="text-right">{invoice.totalAmount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className="text-right">$2,500.00</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};

export const WithBadges: Story = {
  args: {},
  render: () => (
    <Table>
      <TableCaption>Recent transactions with status badges.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Transaction ID</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">TXN001</TableCell>
          <TableCell>
            <Badge className="bg-green-500">Completed</Badge>
          </TableCell>
          <TableCell>John Doe</TableCell>
          <TableCell className="text-right">$120.00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">TXN002</TableCell>
          <TableCell>
            <Badge variant="secondary">Processing</Badge>
          </TableCell>
          <TableCell>Jane Smith</TableCell>
          <TableCell className="text-right">$89.50</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">TXN003</TableCell>
          <TableCell>
            <Badge variant="destructive">Failed</Badge>
          </TableCell>
          <TableCell>Bob Johnson</TableCell>
          <TableCell className="text-right">$45.25</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">TXN004</TableCell>
          <TableCell>
            <Badge variant="outline">Pending</Badge>
          </TableCell>
          <TableCell>Alice Brown</TableCell>
          <TableCell className="text-right">$200.75</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const WithActions: Story = {
  args: {},
  render: () => (
    <Table>
      <TableCaption>User management table with actions.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">John Doe</TableCell>
          <TableCell>john@example.com</TableCell>
          <TableCell>Admin</TableCell>
          <TableCell>
            <Badge className="bg-green-500">Active</Badge>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm">Edit</Button>
              <Button variant="destructive" size="sm">Delete</Button>
            </div>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Jane Smith</TableCell>
          <TableCell>jane@example.com</TableCell>
          <TableCell>Editor</TableCell>
          <TableCell>
            <Badge className="bg-green-500">Active</Badge>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm">Edit</Button>
              <Button variant="destructive" size="sm">Delete</Button>
            </div>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Bob Johnson</TableCell>
          <TableCell>bob@example.com</TableCell>
          <TableCell>Viewer</TableCell>
          <TableCell>
            <Badge variant="secondary">Inactive</Badge>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm">Edit</Button>
              <Button variant="destructive" size="sm">Delete</Button>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const ProductCatalog: Story = {
  args: {},
  render: () => (
    <Table>
      <TableCaption>Product inventory and pricing.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-center">Stock</TableHead>
          <TableHead className="text-right">Price</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>
            <div>
              <div className="font-medium">Wireless Headphones</div>
              <div className="text-sm text-muted-foreground">Premium audio quality</div>
            </div>
          </TableCell>
          <TableCell className="font-mono">WH-001</TableCell>
          <TableCell>Electronics</TableCell>
          <TableCell className="text-center">
            <Badge className="bg-green-500">25</Badge>
          </TableCell>
          <TableCell className="text-right font-medium">$199.99</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>
            <div>
              <div className="font-medium">Smartphone Case</div>
              <div className="text-sm text-muted-foreground">Protective cover</div>
            </div>
          </TableCell>
          <TableCell className="font-mono">SC-002</TableCell>
          <TableCell>Accessories</TableCell>
          <TableCell className="text-center">
            <Badge variant="secondary">5</Badge>
          </TableCell>
          <TableCell className="text-right font-medium">$24.99</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>
            <div>
              <div className="font-medium">Laptop Stand</div>
              <div className="text-sm text-muted-foreground">Ergonomic design</div>
            </div>
          </TableCell>
          <TableCell className="font-mono">LS-003</TableCell>
          <TableCell>Office</TableCell>
          <TableCell className="text-center">
            <Badge variant="destructive">0</Badge>
          </TableCell>
          <TableCell className="text-right font-medium">$79.99</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const SimpleTable: Story = {
  args: {},
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Position</TableHead>
          <TableHead>Department</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Alice Johnson</TableCell>
          <TableCell>Software Engineer</TableCell>
          <TableCell>Engineering</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Bob Smith</TableCell>
          <TableCell>Product Manager</TableCell>
          <TableCell>Product</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Carol Davis</TableCell>
          <TableCell>UX Designer</TableCell>
          <TableCell>Design</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const LargeDataset: Story = {
  args: {},
  render: () => {
    const data = Array.from({ length: 20 }, (_, i) => ({
      id: `ID-${String(i + 1).padStart(3, '0')}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      role: ['Admin', 'Editor', 'Viewer'][i % 3],
      status: ['Active', 'Inactive'][i % 2],
      lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    }));

    return (
      <div className="max-h-96 overflow-auto">
        <Table>
          <TableCaption>Large dataset with scrollable container.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-mono">{user.id}</TableCell>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>
                  <Badge variant={user.status === 'Active' ? 'default' : 'secondary'}>
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell>{user.lastLogin}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  },
};

export const EmptyState: Story = {
  args: {},
  render: () => (
    <Table>
      <TableCaption>No data available.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
            No results found.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};