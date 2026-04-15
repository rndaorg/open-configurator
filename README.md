# Open Configurator - Universal Product Configurator

[![Deploy to Production](https://img.shields.io/badge/deploy-production-green)](https://lovable.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-181818?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)

> **Transform the way customers configure and purchase custom products with our beautiful, intuitive product configurator.**

Open Configurator is a modern, full-stack product configurator that enables businesses to offer customizable products with real-time pricing, visual feedback, and seamless user experience. Perfect for businesses selling bicycles, generators, furniture, electronics, or any configurable products.

![ConfigureMax Hero](public/preview.png?w=1200&h=600&fit=crop&crop=center)

## ✨ Features

### 🎨 **Beautiful, Modern Interface**
- Glass morphism design with smooth animations
- Responsive design that works on all devices
- Real-time visual feedback during configuration
- Intuitive step-by-step configuration process

### ⚡ **Powerful Configurator Engine**
- **AI-Powered Rule Engine**: Intelligent validation and constraint system
- **Dynamic Pricing Engine**: Complex pricing rules with volume discounts and tiered pricing
- **3D Product Visualization**: Interactive 3D models with real-time configuration updates
- **Smart Recommendations**: AI-powered suggestions based on customer preferences
- **Configuration Comparison**: Side-by-side comparison of different setups
- **Real-time Inventory**: Live stock checking and availability updates
- **Advanced Analytics**: Comprehensive tracking and user behavior insights
- **Save & Share**: Customers can save and share configurations

### 🏢 **Business Ready**
- **Advanced Rule Management**: Configure complex business rules and constraints
- **Multi-tier Pricing**: Volume discounts, bulk pricing, and conditional pricing
- **Real-time Analytics**: Session tracking, conversion analysis, and user insights
- **Inventory Management**: Live stock tracking with low-stock alerts
- **A/B Testing**: Built-in recommendation engine testing capabilities
- **Performance Monitoring**: Real-time performance metrics and optimization suggestions

### 🔧 **Developer Friendly**
- **Full-stack Solution**: Frontend + Backend included with advanced engines
- **Modern Tech Stack**: React, TypeScript, Tailwind CSS, Three.js for 3D
- **Database Included**: PostgreSQL with Supabase and advanced schema
- **Rule Engine SDK**: Powerful rule engine for custom business logic
- **Pricing Engine API**: Flexible pricing system with complex calculations
- **Analytics SDK**: Built-in analytics with custom event tracking
- **3D Integration**: Three.js integration for immersive product visualization

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- A Supabase account (free tier available)

### 1. Clone & Install
```bash
git clone https://github.com/rndaorg/open-configurator.git
cd open-configurator
npm install
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Add your Supabase credentials
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Setup
The database schema is automatically applied when you set up Supabase. Sample data is included for:
- **Bicycles** with frame sizes, colors, and accessories
- **Generators** with power output, fuel types, and features
- **Custom categories** for your specific products

### 4. Run Development Server
```bash
npm run dev
```
Visit `http://localhost:5173` to see your configurator in action!

## 📖 How It Works

### For Customers
1. **Browse Products**: Explore categorized product catalog
2. **Configure**: Step-through configuration options with real-time pricing
3. **Visualize**: See changes reflected instantly
4. **Save & Share**: Save configurations or share with others
5. **Purchase**: Add configured products to cart

### For Businesses
1. **Add Products**: Create products with base pricing
2. **Define Options**: Set up configuration options (colors, sizes, features)
3. **Set Pricing**: Configure price modifiers for each option
4. **Organize**: Use categories to organize product lines
5. **Launch**: Deploy and start selling customized products

## 🛠 Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **3D Visualization**: Three.js, @react-three/fiber, @react-three/drei
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Real-time)
- **UI Components**: Radix UI + shadcn/ui
- **Business Logic**: Custom Rule Engine + Pricing Engine
- **Analytics**: Custom Analytics Tracker with session management
- **Animations**: Tailwind CSS + Custom keyframes + 3D animations
- **State Management**: TanStack Query + React Context
- **Routing**: React Router with advanced navigation
- **Build Tool**: Vite with optimizations
- **Deployment**: Lovable Platform with global CDN

## 📁 Project Structure

```
open-configurator/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── Navigation.tsx   # Multi-page navigation
│   │   ├── ProductCatalog.tsx
│   │   ├── ProductConfigurator.tsx  # Main configurator
│   │   ├── Product3DVisualization.tsx  # 3D product viewer
│   │   ├── RecommendationEngine.tsx    # AI recommendations
│   │   └── ConfigurationComparison.tsx # Side-by-side comparison
│   ├── hooks/               # Custom React hooks
│   │   ├── useProducts.ts   # Product data management
│   │   └── useInventoryCheck.ts  # Real-time inventory
│   ├── services/            # Business logic engines
│   │   ├── ruleEngine.ts    # Advanced rule processing
│   │   ├── pricingEngine.ts # Dynamic pricing calculations
│   │   └── analyticsTracker.ts  # User behavior tracking
│   ├── pages/               # Route components (Home, Features, Products)
│   ├── integrations/        # External service integrations
│   │   └── supabase/        # Supabase client & types
│   └── lib/                 # Utilities and helpers
├── supabase/
│   ├── migrations/          # Database migrations with advanced schema
│   └── config.toml         # Supabase configuration
└── docs/                   # Comprehensive documentation
```

## 🎯 Use Cases

### **Perfect For**
- **Bicycle Shops**: Frame sizes, colors, components, accessories
- **Generator Retailers**: Power output, fuel type, features
- **Furniture Stores**: Materials, colors, dimensions, options
- **Electronics**: Specifications, colors, accessories
- **Automotive**: Options, colors, packages, accessories
- **Custom Manufacturing**: Any configurable product

### **Key Benefits**
- **Increase Sales**: 3D visualization and AI recommendations boost conversion rates
- **Reduce Returns**: Immersive 3D previews show exactly what customers get
- **Streamline Operations**: Automated rule enforcement and dynamic pricing
- **Scale Efficiently**: Handle complex product variations with intelligent engines
- **Data-Driven Insights**: Advanced analytics reveal customer preferences and bottlenecks
- **Future-Proof**: Extensible architecture supports growing business needs

## ⚠️ Security Notice

**Note**: This project implements enterprise-grade security features including authentication, RBAC, RLS, and server-side validation. See our [Security Guide](docs/security.md) for full details on the security implementation.

Security features implemented:
- ✅ Authentication System (Supabase Auth)
- ✅ Role-Based Access Control (RBAC)
- ✅ Row Level Security (RLS) on all tables
- ✅ Server-Side Validation via Edge Functions
- ✅ Input Validation with Zod schemas
- ✅ Secure Session Management

## 📚 Documentation

- [Getting Started Guide](docs/getting-started.md) - Includes security warnings
- [API Reference](docs/api.md) - With security considerations
- [API Specification](docs/api-spec.md) - OpenAPI/Swagger spec
- [Advanced Features](docs/advanced-features.md) - Security best practices
- [Security Guide](docs/security.md) - Comprehensive security review

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Support

- ⭐ Star this repository if you find it helpful
- 🐛 [Report bugs](https://github.com/rndaorg/open-configurator/issues)
- 💡 [Request features](https://github.com/rndaorg/open-configurator/issues)
- 📧 [Contact us](mailto:support@openconfigurator.dev)

## 🚀 Deploy Your Own

Deploy your own Open  instance in minutes with our one-shot deployment.

---

**Ready to transform your product sales?** [Get started now](https://lovable.dev) or [try the demo](https://configuremax-demo.lovable.app).
