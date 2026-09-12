# 🌟 D-SOUL - Social Pulse Intelligence Platform

<div align="center">

![D-SOUL Logo](https://img.shields.io/badge/D--SOUL-Social%20Pulse%20Intelligence-purple?style=for-the-badge&logo=trending-up)

**Your comprehensive social media intelligence and content strategy platform**

[![React](https://img.shields.io/badge/React-18.3.1-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4.19-purple?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4.17-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![DNAI](https://img.shields.io/badge/Built%20with-DNAI-blue?style=flat-square)](https://dnai.com/)

</div>

---

## 🚀 Overview

**D-SOUL** is a cutting-edge social media intelligence platform designed to revolutionize how businesses approach their social media strategy. Built with modern web technologies, it provides comprehensive analytics, competitor analysis, content generation, and strategic insights to help brands dominate their social media presence.

### ✨ Key Features

- 🎯 **Strategic Intelligence Hub** - Comprehensive competitor analysis and market insights
- 📊 **Advanced Analytics Dashboard** - Real-time performance metrics and trend analysis
- 🤖 **AI-Powered Content Generation** - Intelligent content creation based on competitor strategies
- 📱 **Multi-Platform Integration** - Support for LinkedIn, Twitter, Instagram, YouTube, Facebook
- 📈 **Performance Tracking** - Detailed analytics and ROI measurement
- 🎨 **Modern UI/UX** - Beautiful, responsive interface built with shadcn/ui
- 🔄 **Real-time Updates** - Live data synchronization and instant insights

---

## 🛠️ Technology Stack

### Frontend
- **React 18.3.1** - Modern UI library with hooks and concurrent features
- **TypeScript 5.8.3** - Type-safe development with enhanced IDE support
- **Vite 5.4.19** - Lightning-fast build tool and development server
- **React Router DOM 6.30.1** - Client-side routing and navigation

### UI & Styling
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **shadcn/ui** - Beautiful, accessible component library
- **Radix UI** - Headless UI primitives for accessibility
- **Lucide React** - Beautiful, customizable icons
- **Framer Motion** - Smooth animations and transitions

### State Management & Data
- **TanStack Query 5.83.0** - Powerful data synchronization and caching
- **React Hook Form 7.61.1** - Performant forms with easy validation
- **Zod 3.25.76** - TypeScript-first schema validation
- **Supabase 2.57.4** - Backend-as-a-Service for real-time data

### Development Tools
- **ESLint 9.32.0** - Code linting and quality assurance
- **PostCSS 8.5.6** - CSS processing and optimization
- **Autoprefixer** - Automatic vendor prefixing

---

## 🏗️ Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── layout/          # Layout components (AppLayout, etc.)
│   └── ui/              # shadcn/ui component library
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions and API clients
├── pages/               # Application pages/routes
│   ├── Overview.tsx     # Main dashboard overview
│   ├── StrategiesHub.tsx # Strategy management
│   ├── PostingPoint.tsx # Content creation
│   ├── PostingHistory.tsx # Content history
│   ├── Analytics.tsx    # Performance analytics
│   └── SocialIntegration.tsx # Platform integrations
└── main.tsx            # Application entry point
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** or **yarn** - Package manager
- **Git** - Version control

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/DNAI-DSOUL-Frontend.git
   cd DNAI-DSOUL-Frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` to view the application

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run build:dev    # Build in development mode
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
```

---

## 📱 Features Deep Dive

### 🎯 Strategic Intelligence Hub
- **Competitor Analysis**: Deep insights into competitor strategies and performance
- **Market Research**: Comprehensive market trend analysis
- **Strategy Generation**: AI-powered strategy recommendations
- **Performance Benchmarking**: Compare against industry standards

### 📊 Analytics Dashboard
- **Real-time Metrics**: Live performance tracking
- **Visual Charts**: Interactive data visualization with Recharts
- **Custom Reports**: Generate detailed performance reports
- **Export Capabilities**: Download data in multiple formats

### 🤖 Content Generation
- **AI-Powered Creation**: Intelligent content based on competitor analysis
- **Multi-Platform Support**: Generate content for all major social platforms
- **Brand Voice Consistency**: Maintain consistent brand messaging
- **Content Calendar**: Schedule and manage content publication

### 🔗 Social Integration
- **Platform Connections**: Connect multiple social media accounts
- **OAuth Authentication**: Secure authentication with social platforms
- **Cross-Platform Publishing**: Publish content across multiple platforms
- **Engagement Tracking**: Monitor likes, shares, comments, and more

---

## 🎨 Design System

D-SOUL features a modern, accessible design system built on:

- **Color Palette**: Purple gradient theme with professional aesthetics
- **Typography**: Inter font family for optimal readability
- **Components**: 40+ reusable UI components
- **Responsive Design**: Mobile-first approach with breakpoint optimization
- **Accessibility**: WCAG 2.1 AA compliant components

---

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# API Configuration
VITE_API_URL=your_api_url
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Social Media APIs
VITE_LINKEDIN_CLIENT_ID=your_linkedin_client_id
VITE_TWITTER_CLIENT_ID=your_twitter_client_id
VITE_INSTAGRAM_CLIENT_ID=your_instagram_client_id
```

### Tailwind Configuration

The project uses a custom Tailwind configuration with:
- Extended color palette
- Custom spacing and sizing
- Component-specific utilities
- Dark mode support

---

## 🚀 Deployment

### Production Build

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

### Deployment Options

1. **DNAI Platform** (Recommended)
   - Deploy directly from your DNAI dashboard
   - One-click deployment with automatic SSL and CDN

2. **Vercel**
   ```bash
   npm install -g vercel
   vercel --prod
   ```

3. **Netlify**
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=dist
   ```

4. **Custom Domain**
   - Navigate to Project > Settings > Domains
   - Click "Connect Domain" to add your custom domain

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style and conventions
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all checks pass before submitting

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **DNAI** - For the powerful AI-powered development platform
- **shadcn/ui** - For the beautiful component library
- **Radix UI** - For accessible UI primitives
- **Tailwind CSS** - For the utility-first CSS framework
- **React Team** - For the incredible React library

---

## 📞 Support

- **Documentation**: [Project Wiki](https://github.com/your-username/DNAI-DSOUL-Frontend/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-username/DNAI-DSOUL-Frontend/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/DNAI-DSOUL-Frontend/discussions)
- **Email**: support@dsoul.ai

---

<div align="center">

**Built with ❤️ by the D-SOUL Team**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/your-username)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/company/dsoul)
[![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/dsoul_ai)

</div>