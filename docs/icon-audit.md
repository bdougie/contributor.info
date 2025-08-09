# Icon Library Audit

## Current Status

### Libraries in Use
1. **lucide-react** - Primary icon library (34 imports)
2. **@radix-ui/react-icons** - Used for UI components (20 imports)
3. **react-icons** - In package.json but NOT used in code (can be removed)

## Icons Currently Used

### Lucide React Icons (78 unique icons)
```
Activity, AlertCircle, AlertTriangle, ArrowLeft, BarChart3, Book, Bot, BotIcon,
Brain, Bug, Calendar, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Circle,
Clock, Code, Copy, Database, Download, ExternalLink, Eye, File, FileText,
GitBranch, GitCommit, GitFork, Github, GithubIcon, GitPullRequest, GitPullRequestDraft,
Globe, Heart, HelpCircle, Image, Info, Layout, Lightbulb, Link, Link2,
Loader2, LogIn, LogOut, Mail, MessageCircle, MessageSquare, Minus, Moon,
Package, PieChart, Plus, RefreshCw, RotateCcw, Rss, Search, SearchIcon,
Settings, Share2, Shield, Smartphone, Sparkles, Star, Sun, Target,
Terminal, Trash2, TreePine, TrendingDown, TrendingUp, Trophy, Upload, User,
UserCheck, UserPlus, Users, Wifi, WifiOff, X, XCircle, Zap
```

### Radix UI Icons (12 unique icons)
```
ArrowLeftIcon, ArrowRightIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon,
ChevronRightIcon, Cross2Icon, DashIcon, DotsHorizontalIcon, DragHandleDots2Icon,
HamburgerMenuIcon, MagnifyingGlassIcon
```

## Optimization Strategy

### Phase 1: Consolidation
Most Radix icons have equivalents in lucide-react:
- ArrowLeftIcon → ArrowLeft
- ArrowRightIcon → ArrowRight
- CheckIcon → Check
- ChevronDownIcon → ChevronDown
- ChevronLeftIcon → ChevronLeft
- ChevronRightIcon → ChevronRight
- Cross2Icon → X
- DashIcon → Minus
- DotsHorizontalIcon → MoreHorizontal
- DragHandleDots2Icon → GripVertical
- HamburgerMenuIcon → Menu
- MagnifyingGlassIcon → Search

### Phase 2: SVG Sprite Generation
After consolidation, we'll have approximately 80-85 unique icons to include in the sprite.

### Estimated Bundle Size Reduction
- Current: ~400KB (full icon libraries)
- After optimization: ~25-30KB (only used icons as sprites)
- Savings: ~370KB (92.5% reduction)

## Next Steps
1. ✅ Audit complete
2. Replace Radix icons with lucide-react equivalents
3. Generate SVG sprite with only used icons
4. Create optimized Icon component
5. Remove unused dependencies