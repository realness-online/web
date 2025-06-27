# Realness Views Documentation

This document describes all the views in the Realness application. Each view serves a specific purpose in the client-only, offline-first social network.

Time is organized into thoughts intervals of input that are grouped together. your realness updates at most 3 times a day meaning you must wait 8 hours between updates. It's okay though. you have everyone's phone number.

This is a serviece for people who want to trust each other and commited to the dicipline and work to make that happen.

## Core Views

### Navigation (`/`)

**Purpose**: Main navigation hub and home screen
**Key Features**:

- Grid-based navigation to all major sections
- Quick access to camera for creating posters
- writing Statements interface
- Version information and help links
- Account dialog access

**Client-Only Features**:

- All navigation works offline
- Camera access for poster creation
- Local statement storage
- No tracking or analytics

### Thoughts (`/thoughts`)

**Purpose**: Timeline view of all content from you and your relations
**Key Features**:

- Chronological feed of posters and statements
- Fullscreen mode support (press 'F' key)
- Combines content from all your relations
- Real-time updates from local storage

**Client-Only Features**:

- All content stored locally
- Works completely offline
- No server-side feed algorithms
- User controls what content appears

### Posters (`/posters`)

**Purpose**: Gallery of your vector graphics and poster management
**Key Features**:

- Grid display of all your posters
- Add new posters via camera or file picker
- Batch processing of image directories
- Delete posters with confirmation dialog
- Author menu for each poster

**Client-Only Features**:

- Vector graphics created locally
- Image processing in web workers
- Local storage of all poster data
- No cloud processing required

### Editor (`/editor/:id`)

**Purpose**: Full-screen poster editing and optimization
**Key Features**:

- Full-screen SVG viewer
- Pan and zoom controls
- Vector optimization
- Save/back navigation
- Tab-indexed for accessibility

**Client-Only Features**:

- All editing happens locally
- Vector optimization in web workers
- View state persisted in localStorage
- No server-side processing

### Profile (`/profile/:phone_number`)

**Purpose**: Individual user profiles and content
**Key Features**:

- User avatar and information
- Chronological content timeline
- Direct messaging capability
- Download options for content
- Days-based content organization

**Client-Only Features**:

- Profile data stored locally
- Content cached for offline viewing
- No tracking of profile visits
- User controls their own data

## Social Views

### Relations (`/relations`)

**Purpose**: Manage your social connections
**Key Features**:

- List of people you follow
- Quick access to phonebook
- Profile cards for each relation
- Navigation to individual profiles

**Client-Only Features**:

- Relations stored locally
- No server-side friend suggestions
- User controls their network
- Works offline

### PhoneBook (`/phonebook`)

**Purpose**: Directory of all users and sign-up
**Key Features**:

- Browse all users in the network
- Sign-up for new users
- Access to relations management
- User discovery

**Client-Only Features**:

- User directory cached locally
- Sign-up process client-side
- No tracking of user discovery
- Works offline after initial load

### Events (`/events`)

**Purpose**: Calendar and event management
**Key Features**:

- Upcoming events from you and relations
- Event creation from posters
- Chronological event display
- Integration with poster workflow

**Client-Only Features**:

- Events stored locally
- No server-side event coordination
- User controls event visibility
- Works offline

## Content Views

### Statements (`/statements`)

**Purpose**: Text content creation and management
**Key Features**:

- Editable statement interface
- Chronological statement history
- Content organization by day
- Integration with thoughts feed

**Client-Only Features**:

- All text stored locally
- No server-side content moderation
- User controls their statements
- Works offline

## Information Views

### About (`/about`)

**Purpose**: Application overview, philosophy, and feature showcase
**Key Features**:

- **Hero Section**: Application introduction with live poster example
- **Artists Section**: Detailed explanation of poster creation and vector graphics
- **Community Section**: Philosophy for churches, punks, and veterans
- **Developers Section**: Technical architecture and open source information
- **Gallery**: Interactive poster showcase with real-time preference controls
- **Feature Lists**: Comprehensive breakdown of capabilities for each audience

**Content Sections**:

- **For Artists**: Supremely animatable vector graphics, Procreate Dreams workflow, timeline viewing, masking and patterns, real-time graphics settings, iPad optimization, high-performance masking, eighteen gradient options, device optimization
- **For Communities**: Phone number sign-in, clear responsibility lines, decentralized decision making, low-resolution graphics for natural dynamics, web literacy development, direct developer support, PWA unindexed by search engines, internet literacy empowerment, no email/likes/links/SEO
- **For Developers**: Open source with modern best practices, semantic HTML with microdata, complete applications without backend coordination, readability and accessibility focus, simple to complex scalability, opinionated against Tailwind/TypeScript, runtime type validation, fragment identifiers and child selectors, reduced attack surface, server is auth and storage only, affirms infinite web nature, projects live under ${name}.web.app

**Interactive Elements**:

- Live poster examples from admin account
- Real-time preference toggles (fill, stroke, light, emboss, animate, fps)
- Responsive design for all device sizes
- Navigation to documentation and external resources

**Client-Only Features**:

- Static content with no tracking
- Live poster examples load from local storage
- Preference controls work offline
- No analytics or user monitoring
- Educational content about the platform
- Works completely offline

### Docs (`/docs`)

**Purpose**: Technical documentation and help
**Key Features**:

- Vector graphics workflow information
- Name and sync documentation
- Settings explanations
- Integration guides

**Client-Only Features**:

- Static documentation
- No usage tracking
- Educational content
- Works offline

### Style (`/style`)

**Purpose**: CSS testing and development reference
**Key Features**:

- HTML5 element testing
- CSS system validation
- Design system reference
- Development tool

**Client-Only Features**:

- Local testing environment
- No server interaction
- Development reference
- Works offline

## Authentication & Settings

### Sign-on (`/sign-on`)

**Purpose**: User authentication and account setup
**Key Features**:

- Phone number authentication
- Name setup for new users
- Account cleanup options
- Integration with Firebase Auth

**Client-Only Features**:

- Minimal server interaction (auth only)
- Local account data management
- User controls their authentication
- Clean slate option for privacy

### Settings (`/settings`)

**Purpose**: Application preferences and configuration
**Key Features**:

- Visual preferences (fill, stroke, emboss, animate)
- Performance settings (FPS display)
- Export options (Adobe, simple IDs)
- File system sync options
- Documentation access

**Client-Only Features**:

- All preferences stored locally
- No server-side preference sync
- User controls all settings
- Works offline

## View Architecture

### Client-Only Design Principles

- **No Tracking**: Views don't collect analytics or user behavior data
- **Offline-First**: All views work without internet connection
- **Local Storage**: Data persists in localStorage and IndexedDB
- **User Control**: Users control their own data and experience
- **Privacy-First**: No server-side data collection or processing

### Storage Strategy

- **Small Data** (< 21KB): localStorage (preferences, view states, small content)
- **Large Data** (> 21KB): IndexedDB (posters, statements, user data)
- **Size Thresholds**: MIN=21KB, MID=34KB, MAX=55KB

### Navigation Pattern

- **Grid-Based**: Main navigation uses a 2x3 grid for easy access
- **Color-Coded**: Each section has distinct colors for visual organization
- **Keyboard Accessible**: All navigation supports keyboard and screen readers
- **Responsive**: Adapts to different screen sizes and orientations

### Content Organization

- **Chronological**: Content organized by date and time
- **Days-Based**: Grouped by calendar days for natural browsing
- **User-Centric**: Content filtered by user relationships
- **Local Control**: Users decide what content to display

This view architecture supports the core philosophy of Realness: providing full functionality without tracking, working solely on the client while maintaining rich social features and creative tools.
