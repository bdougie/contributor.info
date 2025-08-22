import type { Meta, StoryObj } from '@storybook/react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { 
  Command, 
  Search, 
  Settings, 
  User, 
  Moon, 
  Sun, 
  Globe,
  Bell,
  Check,
  X,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown
} from 'lucide-react';
import { within, userEvent } from '@storybook/test';

const meta: Meta = {
  title: 'Composite/Interactive Features',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Interactive feature patterns combining multiple components for rich user interactions.',
      },
    },
  },
  tags: ['autodocs', 'interaction'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Command Palette Component
const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = [
    { id: 1, label: 'Search repositories...', icon: Search, shortcut: '⌘K', category: 'General' },
    { id: 2, label: 'Go to profile', icon: User, shortcut: '⌘P', category: 'Navigation' },
    { id: 3, label: 'Open settings', icon: Settings, shortcut: '⌘,', category: 'Navigation' },
    { id: 4, label: 'Toggle theme', icon: Moon, shortcut: '⌘T', category: 'Preferences' },
    { id: 5, label: 'Switch language', icon: Globe, shortcut: '⌘L', category: 'Preferences' },
    { id: 6, label: 'View notifications', icon: Bell, shortcut: '⌘N', category: 'Actions' },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase())
  );

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, typeof commands>);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Command Palette Demo</h2>
            <p className="text-gray-600 mb-4">
              Press <kbd className="px-2 py-1 bg-gray-100 border rounded">⌘K</kbd> or click the button to open the command palette
            </p>
            <Button onClick={() => setIsOpen(true)} className="gap-2">
              <Command className="h-4 w-4" />
              Open Command Palette
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setIsOpen(false)}
        aria-label="Close command palette"
      />
      <div className="fixed inset-x-0 top-20 z-50 max-w-2xl mx-auto px-4">
        <Card className="overflow-hidden">
          <div className="flex items-center border-b px-4 py-3">
            <Search className="h-5 w-5 text-gray-400 mr-3" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Type a command or search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border-0 focus:ring-0 p-0"
              aria-label="Command search"
            />
            <kbd className="px-2 py-1 text-xs bg-gray-100 rounded">ESC</kbd>
          </div>
          
          <div className="max-h-96 overflow-y-auto p-2">
            {Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category} className="mb-4">
                <div className="text-xs font-semibold text-gray-500 px-2 py-1">
                  {category}
                </div>
                {cmds.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-100 transition-colors"
                      onClick={() => {
                        console.log(`Executing: ${cmd.label}`);
                        setIsOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-gray-500" />
                        <span>{cmd.label}</span>
                      </div>
                      <kbd className="text-xs px-2 py-1 bg-gray-100 rounded">
                        {cmd.shortcut}
                      </kbd>
                    </button>
                  );
                })}
              </div>
            ))}
            
            {filteredCommands.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No commands found for "{search}"
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
};

// Notification System Component
const NotificationSystem = () => {
  const [notifications, setNotifications] = useState<Array<{
    id: number;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
  }>>([
    { id: 1, type: 'info', title: 'New Feature', message: 'Check out our new dashboard!', timestamp: new Date(), read: false },
    { id: 2, type: 'success', title: 'Deploy Successful', message: 'Your changes are now live.', timestamp: new Date(Date.now() - 3600000), read: false },
    { id: 3, type: 'warning', title: 'Storage Limit', message: 'You\'re approaching your storage limit.', timestamp: new Date(Date.now() - 7200000), read: true },
    { id: 4, type: 'error', title: 'Build Failed', message: 'The latest build failed. Check logs for details.', timestamp: new Date(Date.now() - 10800000), read: true },
  ]);

  const [showDropdown, setShowDropdown] = useState(false);
  const [settings, setSettings] = useState({
    desktop: true,
    email: true,
    push: false,
    sound: true,
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="h-5 w-5 text-blue-500" />;
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Bell className="h-5 w-5" />;
    }
  };

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const markAsRead = (id: number) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
    setShowDropdown(false);
  };

  const addNotification = (type: 'info' | 'success' | 'warning' | 'error') => {
    const messages = {
      info: { title: 'Information', message: 'This is an informational notification.' },
      success: { title: 'Success!', message: 'Operation completed successfully.' },
      warning: { title: 'Warning', message: 'Please review this important information.' },
      error: { title: 'Error', message: 'An error occurred. Please try again.' },
    };

    const newNotification = {
      id: Date.now(),
      type,
      ...messages[type],
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-start gap-8">
          {/* Notification Center */}
          <Card className="flex-1 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Notification Center</h2>
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="relative"
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-10">
                    <div className="p-4 border-b">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Notifications</h3>
                        <div className="flex gap-2">
                          {unreadCount > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={markAllAsRead}
                              className="text-xs"
                            >
                              Mark all read
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearAll}
                            className="text-xs"
                          >
                            Clear all
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          No notifications
                        </div>
                      ) : (
                        notifications.map(notification => (
                          <div
                            key={notification.id}
                            className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${
                              !notification.read ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => markAsRead(notification.id)}
                          >
                            <div className="flex gap-3">
                              {getIcon(notification.type)}
                              <div className="flex-1">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-semibold text-sm">{notification.title}</h4>
                                    <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                                  </div>
                                  {!notification.read && (
                                    <div className="h-2 w-2 bg-blue-500 rounded-full mt-1" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                  {formatTime(notification.timestamp)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notification Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold">Notification Settings</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="desktop">Desktop Notifications</Label>
                  <Switch
                    id="desktop"
                    checked={settings.desktop}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, desktop: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="email">Email Notifications</Label>
                  <Switch
                    id="email"
                    checked={settings.email}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, email: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="push">Push Notifications</Label>
                  <Switch
                    id="push"
                    checked={settings.push}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, push: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="sound">Sound</Label>
                  <Switch
                    id="sound"
                    checked={settings.sound}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, sound: checked }))}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Test Notifications */}
          <Card className="w-80 p-6">
            <h3 className="font-semibold mb-4">Test Notifications</h3>
            <div className="space-y-3">
              <Button
                onClick={() => addNotification('info')}
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <Info className="h-4 w-4 text-blue-500" />
                Send Info Notification
              </Button>
              <Button
                onClick={() => addNotification('success')}
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <CheckCircle className="h-4 w-4 text-green-500" />
                Send Success Notification
              </Button>
              <Button
                onClick={() => addNotification('warning')}
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Send Warning Notification
              </Button>
              <Button
                onClick={() => addNotification('error')}
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <XCircle className="h-4 w-4 text-red-500" />
                Send Error Notification
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Theme Switcher Component
const ThemeSwitcher = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');
  const [autoSwitch, setAutoSwitch] = useState(true);
  const [customColors, setCustomColors] = useState({
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#f59e0b',
  });

  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setActualTheme(mediaQuery.matches ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent) => {
        setActualTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      setActualTheme(theme);
    }
  }, [theme]);

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Settings },
  ];

  return (
    <div className={`min-h-screen ${actualTheme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'} p-8 transition-colors`}>
      <div className="max-w-4xl mx-auto">
        <Card className={`p-6 ${actualTheme === 'dark' ? 'bg-gray-800 text-white' : ''}`}>
          <h2 className="text-xl font-semibold mb-6">Theme Settings</h2>

          {/* Theme Selection */}
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Appearance</h3>
              <div className="grid grid-cols-3 gap-3">
                {themes.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value as typeof theme)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      theme === value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`h-8 w-8 mx-auto mb-2 ${
                      theme === value ? 'text-blue-500' : 'text-gray-500'
                    }`} />
                    <div className="text-sm font-medium">{label}</div>
                    {value === 'system' && (
                      <div className="text-xs text-gray-500 mt-1">
                        Currently: {actualTheme}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Switch */}
            <div className="flex items-center justify-between py-4 border-y">
              <div>
                <Label htmlFor="auto-switch" className="text-base">
                  Auto-switch at sunset
                </Label>
                <p className="text-sm text-gray-500">
                  Automatically switch between light and dark themes
                </p>
              </div>
              <Switch
                id="auto-switch"
                checked={autoSwitch}
                onCheckedChange={setAutoSwitch}
              />
            </div>

            {/* Custom Colors */}
            <div>
              <h3 className="font-semibold mb-3">Custom Colors</h3>
              <div className="space-y-3">
                {Object.entries(customColors).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-4">
                    <Label htmlFor={key} className="w-24 capitalize">
                      {key}
                    </Label>
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="color"
                        id={key}
                        value={value}
                        onChange={(e) => setCustomColors(prev => ({
                          ...prev,
                          [key]: e.target.value
                        }))}
                        className="h-10 w-10 rounded cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={value}
                        onChange={(e) => setCustomColors(prev => ({
                          ...prev,
                          [key]: e.target.value
                        }))}
                        className="flex-1"
                      />
                      <div 
                        className="h-10 w-20 rounded"
                        style={{ backgroundColor: value }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <h3 className="font-semibold mb-3">Preview</h3>
              <div className={`p-6 rounded-lg ${
                actualTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              }`}>
                <div className="flex gap-3 mb-4">
                  <Button 
                    style={{ backgroundColor: customColors.primary }}
                    className="text-white"
                  >
                    Primary Button
                  </Button>
                  <Button 
                    style={{ backgroundColor: customColors.secondary }}
                    className="text-white"
                  >
                    Secondary Button
                  </Button>
                  <Button 
                    style={{ backgroundColor: customColors.accent }}
                    className="text-white"
                  >
                    Accent Button
                  </Button>
                </div>
                <p className={actualTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  This is how your theme will look with the selected colors and appearance mode.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// Language Selector Component
const LanguageSelector = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [showDropdown, setShowDropdown] = useState(false);
  const [autoDetect, setAutoDetect] = useState(false);

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  ];

  const currentLanguage = languages.find(l => l.code === selectedLanguage) || languages[0];

  const translations: Record<string, Record<string, string>> = {
    en: {
      title: 'Language Settings',
      selectLanguage: 'Select Language',
      autoDetect: 'Auto-detect language',
      autoDetectDesc: 'Automatically detect language based on your location',
      preview: 'Preview',
      welcome: 'Welcome to our application!',
      description: 'This is how content will appear in the selected language.',
      popularLanguages: 'Popular Languages',
      allLanguages: 'All Languages',
    },
    es: {
      title: 'Configuración de Idioma',
      selectLanguage: 'Seleccionar Idioma',
      autoDetect: 'Detectar idioma automáticamente',
      autoDetectDesc: 'Detectar automáticamente el idioma según tu ubicación',
      preview: 'Vista previa',
      welcome: '¡Bienvenido a nuestra aplicación!',
      description: 'Así es como aparecerá el contenido en el idioma seleccionado.',
      popularLanguages: 'Idiomas Populares',
      allLanguages: 'Todos los Idiomas',
    },
    fr: {
      title: 'Paramètres de Langue',
      selectLanguage: 'Sélectionner la Langue',
      autoDetect: 'Détecter automatiquement la langue',
      autoDetectDesc: 'Détecter automatiquement la langue en fonction de votre emplacement',
      preview: 'Aperçu',
      welcome: 'Bienvenue dans notre application!',
      description: 'Voici comment le contenu apparaîtra dans la langue sélectionnée.',
      popularLanguages: 'Langues Populaires',
      allLanguages: 'Toutes les Langues',
    },
  };

  const t = (key: string) => {
    const trans = translations[selectedLanguage] || translations.en;
    return trans[key] || translations.en[key];
  };

  const popularLanguages = ['en', 'es', 'fr', 'de', 'zh', 'ja'];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">{t('title')}</h2>
            <Badge variant="outline" className="gap-1">
              <Globe className="h-3 w-3" />
              {currentLanguage.nativeName}
            </Badge>
          </div>

          {/* Language Selector Dropdown */}
          <div className="space-y-6">
            <div>
              <Label className="text-base mb-3 block">{t('selectLanguage')}</Label>
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{currentLanguage.flag}</span>
                    <div className="text-left">
                      <div className="font-medium">{currentLanguage.nativeName}</div>
                      <div className="text-sm text-gray-500">{currentLanguage.name}</div>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${
                    showDropdown ? 'rotate-180' : ''
                  }`} />
                </button>

                {showDropdown && (
                  <div className="absolute z-10 w-full mt-2 bg-white border rounded-lg shadow-lg max-h-96 overflow-y-auto">
                    {/* Popular Languages */}
                    <div className="p-2">
                      <div className="text-xs font-semibold text-gray-500 px-2 py-1">
                        {t('popularLanguages')}
                      </div>
                      {languages.filter(l => popularLanguages.includes(l.code)).map(lang => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setSelectedLanguage(lang.code);
                            setShowDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors ${
                            selectedLanguage === lang.code ? 'bg-blue-50' : ''
                          }`}
                        >
                          <span className="text-xl">{lang.flag}</span>
                          <div className="flex-1 text-left">
                            <div className="font-medium">{lang.nativeName}</div>
                            <div className="text-sm text-gray-500">{lang.name}</div>
                          </div>
                          {selectedLanguage === lang.code && (
                            <Check className="h-4 w-4 text-blue-500" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* All Languages */}
                    <div className="border-t p-2">
                      <div className="text-xs font-semibold text-gray-500 px-2 py-1">
                        {t('allLanguages')}
                      </div>
                      {languages.filter(l => !popularLanguages.includes(l.code)).map(lang => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setSelectedLanguage(lang.code);
                            setShowDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors ${
                            selectedLanguage === lang.code ? 'bg-blue-50' : ''
                          }`}
                        >
                          <span className="text-xl">{lang.flag}</span>
                          <div className="flex-1 text-left">
                            <div className="font-medium">{lang.nativeName}</div>
                            <div className="text-sm text-gray-500">{lang.name}</div>
                          </div>
                          {selectedLanguage === lang.code && (
                            <Check className="h-4 w-4 text-blue-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Auto-detect Option */}
            <div className="flex items-center justify-between py-4 border-y">
              <div>
                <Label htmlFor="auto-detect" className="text-base">
                  {t('autoDetect')}
                </Label>
                <p className="text-sm text-gray-500">
                  {t('autoDetectDesc')}
                </p>
              </div>
              <Switch
                id="auto-detect"
                checked={autoDetect}
                onCheckedChange={setAutoDetect}
              />
            </div>

            {/* Preview */}
            <div>
              <h3 className="font-semibold mb-3">{t('preview')}</h3>
              <Card className="p-6 bg-gray-50">
                <h4 className="text-lg font-semibold mb-2">{t('welcome')}</h4>
                <p className="text-gray-600">{t('description')}</p>
                <div className="mt-4 flex gap-3">
                  <Button>{selectedLanguage === 'en' ? 'Continue' : selectedLanguage === 'es' ? 'Continuar' : selectedLanguage === 'fr' ? 'Continuer' : 'Continue'}</Button>
                  <Button variant="outline">{selectedLanguage === 'en' ? 'Cancel' : selectedLanguage === 'es' ? 'Cancelar' : selectedLanguage === 'fr' ? 'Annuler' : 'Cancel'}</Button>
                </div>
              </Card>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// Stories
export const CommandPaletteStory: Story = {
  name: 'Command Palette',
  render: () => <CommandPalette />,
  parameters: {
    docs: {
      description: {
        story: 'A command palette for quick navigation and actions with keyboard shortcuts.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button', { name: /open command palette/i });
    await userEvent.click(button);
    await new Promise(resolve => setTimeout(resolve, 500));
    const input = await canvas.findByPlaceholderText(/type a command/i);
    await userEvent.type(input, 'settings');
    await new Promise(resolve => setTimeout(resolve, 500));
  },
};

export const NotificationSystemStory: Story = {
  name: 'Notification System',
  render: () => <NotificationSystem />,
  parameters: {
    docs: {
      description: {
        story: 'A comprehensive notification system with settings and real-time updates.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const infoButton = await canvas.findByRole('button', { name: /send info notification/i });
    await userEvent.click(infoButton);
    await new Promise(resolve => setTimeout(resolve, 500));
    const successButton = await canvas.findByRole('button', { name: /send success notification/i });
    await userEvent.click(successButton);
  },
};

export const ThemeSwitcherStory: Story = {
  name: 'Theme Switcher',
  render: () => <ThemeSwitcher />,
  parameters: {
    docs: {
      description: {
        story: 'A theme switcher with light/dark/system modes and custom color configuration.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const darkButton = await canvas.findByRole('button', { name: /dark/i });
    await userEvent.click(darkButton);
    await new Promise(resolve => setTimeout(resolve, 500));
    const lightButton = await canvas.findByRole('button', { name: /light/i });
    await userEvent.click(lightButton);
  },
};

export const LanguageSelectorStory: Story = {
  name: 'Language Selector',
  render: () => <LanguageSelector />,
  parameters: {
    docs: {
      description: {
        story: 'A language selector with auto-detection and live preview of translations.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dropdown = await canvas.findByRole('button', { name: /english/i });
    await userEvent.click(dropdown);
    await new Promise(resolve => setTimeout(resolve, 500));
    const spanish = await canvas.findByRole('button', { name: /español/i });
    await userEvent.click(spanish);
  },
};