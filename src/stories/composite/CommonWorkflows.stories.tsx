import type { Meta, StoryObj } from "@storybook/react";
import { within, userEvent, expect } from "@storybook/test";
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Upload,
  FileText,
  Image,
  Trash2,
  Edit,
  Eye,
  Download,
  ChevronRight,
  ChevronLeft,
  Plus,
  Search,
  Filter,
  MoreVertical,
  AlertCircle,
  ArrowUpDown,
  Check,
  X,
} from "lucide-react";

const meta = {
  title: "Composite/Common Workflows",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: "Common workflow patterns for typical application tasks.",
      },
    },
  },
  tags: ["autodocs", "composite", "workflows"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Onboarding Flow
const OnboardingFlow = () => {
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [data, setData] = useState({
    name: "",
    organization: "",
    repositories: [] as string[],
    preferences: {
      emailUpdates: true,
      publicProfile: true,
    },
  });

  const steps = [
    { id: 1, title: "Welcome", description: "Get started with Contributor.info" },
    { id: 2, title: "Profile", description: "Set up your profile" },
    { id: 3, title: "Connect", description: "Connect your repositories" },
    { id: 4, title: "Preferences", description: "Configure your preferences" },
    { id: 5, title: "Complete", description: "You're all set!" },
  ];

  const handleNext = () => {
    if (!completed.includes(step)) {
      setCompleted([...completed, step]);
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleComplete = () => {
    alert("Onboarding complete!");
  };

  return (
    <div className="w-[600px]">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((s, index) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="relative">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    completed.includes(s.id)
                      ? "bg-green-500 border-green-500 text-white"
                      : s.id === step
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "bg-white border-gray-300 text-gray-500"
                  }`}
                >
                  {completed.includes(s.id) ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    s.id
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`absolute top-5 left-10 w-full h-0.5 ${
                      completed.includes(s.id) ? "bg-green-500" : "bg-gray-300"
                    }`}
                    style={{ width: "calc(100% + 40px)" }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">{steps[step - 1].title}</h3>
          <p className="text-sm text-gray-600">{steps[step - 1].description}</p>
        </div>
      </div>

      {/* Content */}
      <Card>
        <CardContent className="pt-6">
          {step === 1 && (
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold mb-4">Welcome to Contributor.info!</h2>
              <p className="text-gray-600 mb-6">
                Let's get you set up in just a few minutes. We'll help you connect your
                repositories and start tracking contributions.
              </p>
              <div className="space-y-4 text-left max-w-md mx-auto">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Track Contributions</p>
                    <p className="text-sm text-gray-600">
                      Monitor pull requests, issues, and code reviews
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Visualize Impact</p>
                    <p className="text-sm text-gray-600">
                      See your team's contributions in beautiful charts
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Celebrate Success</p>
                    <p className="text-sm text-gray-600">
                      Recognize top contributors and milestones
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org">Organization (Optional)</Label>
                <Input
                  id="org"
                  value={data.organization}
                  onChange={(e) => setData({ ...data, organization: e.target.value })}
                  placeholder="Acme Corp"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Connect Your Repositories</Label>
                <p className="text-sm text-gray-600">
                  Select the repositories you want to track
                </p>
              </div>
              <div className="space-y-2">
                {["frontend", "backend", "mobile-app", "documentation"].map((repo) => (
                  <div key={repo} className="flex items-center space-x-2">
                    <Checkbox
                      id={repo}
                      checked={data.repositories.includes(repo)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setData({
                            ...data,
                            repositories: [...data.repositories, repo],
                          });
                        } else {
                          setData({
                            ...data,
                            repositories: data.repositories.filter((r) => r !== repo),
                          });
                        }
                      }}
                    />
                    <Label htmlFor={repo} className="font-normal cursor-pointer">
                      organization/{repo}
                    </Label>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add More Repositories
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Configure Your Preferences</Label>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="emails">Email Updates</Label>
                    <p className="text-sm text-gray-600">
                      Receive weekly summary of activity
                    </p>
                  </div>
                  <Checkbox
                    id="emails"
                    checked={data.preferences.emailUpdates}
                    onCheckedChange={(checked) =>
                      setData({
                        ...data,
                        preferences: {
                          ...data.preferences,
                          emailUpdates: checked as boolean,
                        },
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="public">Public Profile</Label>
                    <p className="text-sm text-gray-600">
                      Make your contribution stats public
                    </p>
                  </div>
                  <Checkbox
                    id="public"
                    checked={data.preferences.publicProfile}
                    onCheckedChange={(checked) =>
                      setData({
                        ...data,
                        preferences: {
                          ...data.preferences,
                          publicProfile: checked as boolean,
                        },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">You're All Set!</h2>
              <p className="text-gray-600 mb-6">
                Your account has been set up successfully. You can now start tracking
                contributions and visualizing your team's impact.
              </p>
              <div className="space-y-2">
                <Button className="w-full" onClick={handleComplete}>
                  Go to Dashboard
                </Button>
                <Button variant="outline" className="w-full">
                  Invite Team Members
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        {step < 5 && (
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export const OnboardingFlowExample: Story = {
  render: () => <OnboardingFlow />,
};

// Data Table with Actions
const DataTableWithActions = () => {
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const data = [
    { id: 1, name: "John Doe", email: "john@example.com", role: "Admin", status: "Active" },
    { id: 2, name: "Jane Smith", email: "jane@example.com", role: "User", status: "Active" },
    { id: 3, name: "Bob Johnson", email: "bob@example.com", role: "User", status: "Inactive" },
    { id: 4, name: "Alice Brown", email: "alice@example.com", role: "Admin", status: "Active" },
    { id: 5, name: "Charlie Davis", email: "charlie@example.com", role: "User", status: "Pending" },
  ];

  const filteredData = data
    .filter((item) => {
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;
      const aVal = a[sortColumn as keyof typeof a];
      const bVal = b[sortColumn as keyof typeof b];
      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(filteredData.map((item) => item.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedRows([...selectedRows, id]);
    } else {
      setSelectedRows(selectedRows.filter((rowId) => rowId !== id));
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  return (
    <div className="w-[900px] space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                Manage your team members and their permissions
              </CardDescription>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[250px]"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedRows.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedRows.length} selected
                </span>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        filteredData.length > 0 &&
                        selectedRows.length === filteredData.length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                    <div className="flex items-center">
                      Name
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("email")}>
                    <div className="flex items-center">
                      Email
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRows.includes(item.id)}
                        onCheckedChange={(checked) =>
                          handleSelectRow(item.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "Active"
                            ? "default"
                            : item.status === "Inactive"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const DataTableExample: Story = {
  render: () => <DataTableWithActions />,
};

// File Upload with Preview
const FileUploadWithPreview = () => {
  const [files, setFiles] = useState<
    Array<{
      id: string;
      name: string;
      size: number;
      type: string;
      preview?: string;
      progress: number;
      status: "uploading" | "complete" | "error";
    }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles = selectedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      progress: 0,
      status: "uploading" as const,
    }));

    setFiles([...files, ...newFiles]);

    // Simulate upload progress
    newFiles.forEach((file) => {
      const interval = setInterval(() => {
        setFiles((prevFiles) =>
          prevFiles.map((f) => {
            if (f.id === file.id) {
              const newProgress = Math.min(f.progress + 10, 100);
              return {
                ...f,
                progress: newProgress,
                status: newProgress === 100 ? "complete" : "uploading",
              };
            }
            return f;
          })
        );
      }, 200);

      setTimeout(() => clearInterval(interval), 2200);
    });
  };

  const removeFile = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="w-[600px] space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            Drag and drop files here or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Upload Area */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const droppedFiles = Array.from(e.dataTransfer.files);
              handleFileSelect({
                target: { files: droppedFiles },
              } as any);
            }}
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              Drag and drop your files here, or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Support for images, documents, and archives up to 10MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-6 space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center space-x-3 p-3 border rounded-lg"
                >
                  {/* Preview */}
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-10 h-10 object-cover rounded"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                      <FileText className="h-5 w-5 text-gray-400" />
                    </div>
                  )}

                  {/* File Info */}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    {file.status === "uploading" && (
                      <div className="mt-1">
                        <Progress value={file.progress} className="h-1" />
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  {file.status === "complete" ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : file.status === "error" ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  )}

                  {/* Remove */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(file.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <p className="text-sm text-gray-500">
            {files.length} file(s) selected
          </p>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => setFiles([])}>
              Clear All
            </Button>
            <Button disabled={files.some((f) => f.status === "uploading")}>
              Upload Files
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export const FileUploadExample: Story = {
  render: () => <FileUploadWithPreview />,
};

// Multi-Step Wizard
const MultiStepWizard = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    projectName: "",
    projectType: "",
    teamSize: "",
    budget: "",
    timeline: "",
    description: "",
  });

  const steps = [
    { title: "Project Details", fields: ["projectName", "projectType"] },
    { title: "Team & Resources", fields: ["teamSize", "budget"] },
    { title: "Timeline", fields: ["timeline"] },
    { title: "Review & Submit", fields: [] },
  ];

  const validateStep = () => {
    const currentFields = steps[currentStep].fields;
    for (const field of currentFields) {
      if (!formData[field as keyof typeof formData]) {
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    alert("Project created successfully!");
  };

  return (
    <div className="w-[600px]">
      <Card>
        <CardHeader>
          <CardTitle>Create New Project</CardTitle>
          <CardDescription>
            Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Progress */}
          <div className="mb-6">
            <Progress value={((currentStep + 1) / steps.length) * 100} />
          </div>

          {/* Step Content */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  value={formData.projectName}
                  onChange={(e) =>
                    setFormData({ ...formData, projectName: e.target.value })
                  }
                  placeholder="Enter project name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectType">Project Type</Label>
                <Select
                  value={formData.projectType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, projectType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web">Web Application</SelectItem>
                    <SelectItem value="mobile">Mobile App</SelectItem>
                    <SelectItem value="desktop">Desktop Software</SelectItem>
                    <SelectItem value="api">API Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamSize">Team Size</Label>
                <Select
                  value={formData.teamSize}
                  onValueChange={(value) =>
                    setFormData({ ...formData, teamSize: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-5">1-5 people</SelectItem>
                    <SelectItem value="6-10">6-10 people</SelectItem>
                    <SelectItem value="11-20">11-20 people</SelectItem>
                    <SelectItem value="20+">20+ people</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Budget Range</Label>
                <Select
                  value={formData.budget}
                  onValueChange={(value) =>
                    setFormData({ ...formData, budget: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select budget range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="<10k">Less than $10,000</SelectItem>
                    <SelectItem value="10k-50k">$10,000 - $50,000</SelectItem>
                    <SelectItem value="50k-100k">$50,000 - $100,000</SelectItem>
                    <SelectItem value="100k+">More than $100,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timeline">Project Timeline</Label>
                <Select
                  value={formData.timeline}
                  onValueChange={(value) =>
                    setFormData({ ...formData, timeline: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timeline" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-3">1-3 months</SelectItem>
                    <SelectItem value="3-6">3-6 months</SelectItem>
                    <SelectItem value="6-12">6-12 months</SelectItem>
                    <SelectItem value="12+">More than 12 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Additional Details (Optional)</Label>
                <textarea
                  id="description"
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={4}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Provide any additional details about your project..."
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please review your project details before submitting.
                </AlertDescription>
              </Alert>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Project Name:</span>
                  <span className="font-medium">{formData.projectName}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Project Type:</span>
                  <span className="font-medium">{formData.projectType}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Team Size:</span>
                  <span className="font-medium">{formData.teamSize}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Budget:</span>
                  <span className="font-medium">{formData.budget}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Timeline:</span>
                  <span className="font-medium">{formData.timeline} months</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit}>
              <Check className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export const MultiStepWizardExample: Story = {
  render: () => <MultiStepWizard />,
};