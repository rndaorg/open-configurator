# Open Configurator - Universal Product Configurator

[![Deploy to Production](https://img.shields.io/badge/deploy-production-green)](https://lovable.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-181818?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)

> **Transform the way customers configure and purchase custom products with our beautiful, intuitive product configurator.**

Open Configurator is a modern, full-stack product configurator that enables businesses to offer customizable products with real-time pricing, visual feedback, and seamless user experience. Perfect for businesses selling bicycles, generators, furniture, electronics, or any configurable products.


![Open Configurator](<img width="1200" height="600" fit="crop" crop="center" alt="image" src="https://ibb.co/gF6dkDym" />)

## ✨ Features

### 🎨 **Beautiful, Modern Interface**
- Glass morphism design with smooth animations
- Responsive design that works on all devices
- Real-time visual feedback during configuration
- Intuitive step-by-step configuration process

### ⚡ **Powerful Configurator Engine**
- **Real-time Pricing**: Instant price updates as customers configure
- **Visual Options**: Support for colors, images, and custom previews
- **Required & Optional**: Flexible configuration rules
- **Multi-category Support**: Handle diverse product types
- **Save & Share**: Customers can save and share configurations

### 🏢 **Business Ready**
- **Admin Dashboard**: Easy product and option management
- **Category Management**: Organize products by categories
- **Pricing Control**: Set base prices and option modifiers
- **Inventory Integration**: Track availability and stock
- **Analytics Ready**: Built-in tracking and insights

### 🔧 **Developer Friendly**
- **Full-stack Solution**: Frontend + Backend included
- **Modern Tech Stack**: React, TypeScript, Tailwind CSS
- **Database Included**: PostgreSQL with Supabase
- **API Ready**: RESTful API for integrations
- **Extensible**: Easy to customize and extend

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
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **UI Components**: Radix UI + shadcn/ui
- **Animations**: Tailwind CSS + Custom keyframes
- **State Management**: TanStack Query
- **Routing**: React Router
- **Build Tool**: Vite
- **Deployment**: Lovable Platform

## 📁 Project Structure

```
configuremax/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── HeroSection.tsx  # Landing page hero
│   │   ├── ProductCatalog.tsx
│   │   └── ProductConfigurator.tsx
│   ├── hooks/               # Custom React hooks
│   │   └── useProducts.ts   # Product data management
│   ├── pages/               # Route components
│   ├── integrations/        # External service integrations
│   │   └── supabase/        # Supabase client & types
│   └── lib/                 # Utilities and helpers
├── supabase/
│   ├── migrations/          # Database migrations
│   └── config.toml         # Supabase configuration
└── docs/                   # Documentation
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
- **Increase Sales**: Visual configuration increases conversion rates
- **Reduce Returns**: Customers know exactly what they're getting
- **Streamline Operations**: Automated pricing and configuration tracking
- **Scale Efficiently**: Handle complex product variations easily
- **Improve UX**: Modern, intuitive configuration experience

## 📚 Documentation

- [Getting Started Guide](docs/getting-started.md)
- [Configuration Options](docs/configuration.md)
- [API Reference](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Customization](docs/customization.md)

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
- 🐛 [Report bugs](https://github.com/your-username/configuremax/issues)
- 💡 [Request features](https://github.com/your-username/configuremax/issues)
- 📧 [Contact us](mailto:support@configuremax.com)

## 🚀 Deploy Your Own

Deploy your own Open  instance in minutes with our one-shot deployment.

---

**Ready to transform your product sales?** [Get started now](https://lovable.dev) or [try the demo](https://configuremax-demo.lovable.app).
