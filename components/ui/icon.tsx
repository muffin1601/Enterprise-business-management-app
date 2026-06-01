import type { LucideProps } from 'lucide-react'
import {
  Pencil, Trash2, ChevronRight, ChevronLeft, X, Search, Plus, Mail,
  Eye, ArrowLeft, Users, Phone, Menu, LogOut, History, Archive,
  SlidersHorizontal, Layers, UserPlus, UserCircle, TrendingUp, TrendingDown,
  Settings, Pin, ImageOff, Image, Package, FileText, Minus, Loader2,
  Banknote, Camera, Box, ArrowUpDown, ArrowLeftRight, AlertTriangle,
  ChevronDown, ChevronUp, Check, Circle, RefreshCw, Download, Upload,
  Filter, Tag, Star, Bell, Calendar, Clock, Home, LayoutDashboard,
  ShoppingCart, Receipt, Truck, Building2, User,
  MoreHorizontal, MoreVertical, Info, HelpCircle, Lock, Unlock,
  Copy, ExternalLink, Link2, Globe, MapPin, CreditCard, Wallet,
  BarChart2, PieChart, Activity, Zap,
  FileEdit, FilePlus, FileX, FolderOpen, Paperclip, Send,
  MessageSquare, AtSign, Hash, Percent, DollarSign,
  ArrowRight, ArrowUp, ArrowDown, RotateCcw, Save,
  PlusCircle, MinusCircle, XCircle, CheckCircle, AlertCircle,
  EyeOff, Edit2,
} from 'lucide-react'

// ── Icon name → Lucide component map ──────────────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  // Actions
  'pencil':              Pencil,
  'edit':                Edit2,
  'trash':               Trash2,
  'trash-2':             Trash2,
  'archive':             Archive,
  'save':                Save,
  'copy':                Copy,
  'download':            Download,
  'upload':              Upload,
  'send':                Send,
  'external-link':       ExternalLink,
  'link':                Link2,
  'rotate-ccw':          RotateCcw,
  'refresh':             RefreshCw,

  // Navigation
  'arrow-left':          ArrowLeft,
  'arrow-right':         ArrowRight,
  'arrow-up':            ArrowUp,
  'arrow-down':          ArrowDown,
  'chevron-left':        ChevronLeft,
  'chevron-right':       ChevronRight,
  'chevron-up':          ChevronUp,
  'chevron-down':        ChevronDown,
  'more-horizontal':     MoreHorizontal,
  'more-vertical':       MoreVertical,

  // Interface
  'x':                   X,
  'plus':                Plus,
  'minus':               Minus,
  'search':              Search,
  'filter':              Filter,
  'eye':                 Eye,
  'eye-off':             EyeOff,
  'settings':            Settings,
  'menu':                Menu,
  'menu-2':              Menu,
  'bell':                Bell,
  'info':                Info,
  'help-circle':         HelpCircle,
  'lock':                Lock,
  'unlock':              Unlock,
  'loader-2':            Loader2,

  // Status / feedback
  'check':               Check,
  'check-circle':        CheckCircle,
  'x-circle':            XCircle,
  'plus-circle':         PlusCircle,
  'minus-circle':        MinusCircle,
  'alert-triangle':      AlertTriangle,
  'alert-circle':        AlertCircle,
  'circle':              Circle,

  // Users / org
  'users':               Users,
  'user':                User,
  'user-circle':         UserCircle,
  'user-plus':           UserPlus,
  'building':            Building2,
  'building-2':          Building2,
  'logout':              LogOut,

  // Communication
  'mail':                Mail,
  'phone':               Phone,
  'message-square':      MessageSquare,
  'at-sign':             AtSign,
  'globe':               Globe,
  'map-pin':             MapPin,

  // Files / docs
  'file-text':           FileText,
  'notes':               FileText,
  'file-edit':           FileEdit,
  'file-plus':           FilePlus,
  'file-x':              FileX,
  'file-dollar':         Receipt,
  'file-invoice':        Receipt,
  'folder-open':         FolderOpen,
  'paperclip':           Paperclip,
  'pin':                 Pin,

  // Finance
  'cash':                Banknote,
  'credit-card':         CreditCard,
  'wallet':              Wallet,
  'dollar-sign':         DollarSign,
  'percent':             Percent,
  'hash':                Hash,
  'trending-up':         TrendingUp,
  'trending-down':       TrendingDown,

  // Inventory / products
  'package':             Package,
  'box':                 Box,
  'tag':                 Tag,
  'layers':              Layers,
  'versions':            Layers,
  'shopping-cart':       ShoppingCart,
  'truck':               Truck,
  'delivery':            Truck,

  // Media
  'photo':               Image,
  'image':               Image,
  'photo-off':           ImageOff,
  'camera':              Camera,

  // Charts / analytics
  'bar-chart':           BarChart2,
  'pie-chart':           PieChart,
  'activity':            Activity,
  'zap':                 Zap,

  // Date / time
  'calendar':            Calendar,
  'clock':               Clock,
  'history':             History,

  // Layout
  'home':                Home,
  'layout-dashboard':    LayoutDashboard,

  // Misc
  'arrows-sort':         ArrowUpDown,
  'arrows-exchange':     ArrowLeftRight,
  'adjustments-horizontal': SlidersHorizontal,
  'star':                Star,
  'receipt':             Receipt,
}

// ── Icon component ─────────────────────────────────────────────────────────────
interface IconProps extends Omit<LucideProps, 'ref'> {
  name: string
  size?: number
}

export function Icon({ name, size = 16, strokeWidth = 1.75, ...props }: IconProps) {
  const Comp = ICON_MAP[name] ?? ICON_MAP[name.replace(/_/g, '-')]
  if (!Comp) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Icon] unknown icon: "${name}"`)
    }
    return null
  }
  return <Comp size={size} strokeWidth={strokeWidth} {...props} />
}

export default Icon
