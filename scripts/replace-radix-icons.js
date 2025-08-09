#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mapping of Radix UI icons to lucide-react equivalents
const iconMap = {
  'ArrowLeftIcon': 'ArrowLeft',
  'ArrowRightIcon': 'ArrowRight',
  'CheckIcon': 'Check',
  'ChevronDownIcon': 'ChevronDown',
  'ChevronLeftIcon': 'ChevronLeft',
  'ChevronRightIcon': 'ChevronRight',
  'Cross2Icon': 'X',
  'DashIcon': 'Minus',
  'DotsHorizontalIcon': 'MoreHorizontal',
  'DragHandleDots2Icon': 'GripVertical',
  'HamburgerMenuIcon': 'Menu',
  'MagnifyingGlassIcon': 'Search',
};

// Files to process
const files = [
  'src/components/ui/checkbox.tsx',
  'src/components/ui/command.tsx',
  'src/components/ui/context-menu.tsx',
  'src/components/ui/carousel.tsx',
  'src/components/ui/dialog.tsx',
  'src/components/ui/dropdown-menu.tsx',
  'src/components/ui/input-otp.tsx',
  'src/components/ui/menubar.tsx',
  'src/components/ui/navigation-menu.tsx',
  'src/components/ui/pagination.tsx',
  'src/components/ui/radio-group.tsx',
  'src/components/ui/resizable.tsx',
  'src/components/ui/select.tsx',
  'src/components/ui/sheet.tsx',
  'src/components/ui/toast.tsx',
  'src/components/common/layout/breadcrumbs.tsx',
  'src/components/common/layout/layout.tsx',
];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if file uses Radix icons
  if (content.includes('@radix-ui/react-icons')) {
    // Extract imported icons
    const importMatch = content.match(/import\s*{\s*([^}]+)\s*}\s*from\s*['"]@radix-ui\/react-icons['"]/);
    
    if (importMatch) {
      const importedIcons = importMatch[1].split(',').map(s => s.trim());
      const lucideIcons = [];
      
      importedIcons.forEach(radixIcon => {
        if (iconMap[radixIcon]) {
          lucideIcons.push(iconMap[radixIcon]);
          // Replace icon usage in the file
          const regex = new RegExp(`<${radixIcon}([\\s/>])`, 'g');
          content = content.replace(regex, `<${iconMap[radixIcon]}$1`);
          modified = true;
        }
      });
      
      if (lucideIcons.length > 0) {
        // Replace the import statement
        const oldImport = importMatch[0];
        const newImport = `import { ${lucideIcons.join(', ')} } from 'lucide-react'`;
        content = content.replace(oldImport, newImport);
        
        fs.writeFileSync(filePath, content);
        console.log(`✅ Updated ${file}: ${importedIcons.join(', ')} → ${lucideIcons.join(', ')}`);
      }
    }
  }
});

console.log('\n✨ Icon replacement complete!');