# Getting Started with Open Configurator

Welcome to Open Configurator! This guide will help you set up and customize your advanced product configurator with 3D visualization, AI recommendations, and intelligent pricing in under 30 minutes.

## Overview

Open Configurator is designed to be deployment-ready out of the box while providing enterprise-grade features like rule engines, dynamic pricing, 3D visualization, and AI-powered recommendations. You can have a working product configurator running in minutes, then customize it to match your brand and products.

## Prerequisites

Before you begin, make sure you have:
- Node.js 18 or higher installed
- A Supabase account (free tier works great)
- Basic knowledge of web development (helpful but not required)

## Step 1: Project Setup

### Clone the Repository
```bash
git clone https://github.com/your-username/open-configurator.git
cd open-configurator
npm install
```

### Environment Configuration
Create a `.env` file in your project root:
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project dashboard under Settings → API.

## Step 2: Database Setup

Open Configurator comes with a comprehensive database schema and sample data. The schema includes:

- **Products**: Your main product catalog with 3D model references
- **Categories**: Product organization with visual hierarchies
- **Config Options**: Customization choices (color, size, materials, features)
- **Option Values**: Specific choices within each option with 3D model variants
- **Product Configurations**: Saved customer configurations with analytics
- **Rule Definitions**: Business rules and validation constraints
- **Pricing Rules**: Dynamic pricing with volume discounts and conditions
- **Analytics Sessions**: User behavior tracking and conversion analytics
- **3D Models**: Product visualization assets and configuration mappings

### Sample Data Included

The system comes pre-loaded with:
- **Mountain Bike**: Configurable with frame size, color, accessories, and 3D visualization
- **Road Bike**: Multiple color options, component choices, and interactive 3D model
- **Portable Generator**: Power output, fuel type options with rule-based constraints
- **Standby Generator**: Advanced features, sizing options, and dynamic pricing tiers

### Advanced Features Ready
- **3D Product Models**: Interactive visualization with real-time configuration updates
- **AI Recommendations**: Smart suggestions based on customer behavior patterns
- **Rule Engine**: Pre-configured business rules and validation constraints
- **Dynamic Pricing**: Volume discounts and conditional pricing already set up
- **Analytics Tracking**: User behavior tracking and conversion optimization

## Step 3: Run Development Server

```bash
npm run dev
```

Open `http://localhost:5173` in your browser. You should see:
- Beautiful landing page with hero section and navigation
- Multi-page structure (Home, Features, Products)
- Product catalog with sample products and 3D previews
- Working configurator with real-time pricing and 3D visualization
- AI-powered recommendation engine in action
- Configuration comparison tools

## Step 4: Customize Your Products

### Adding Your First Product

1. **Navigate to Supabase Dashboard**
   - Go to your Supabase project
   - Open the Table Editor

2. **Add a Category** (if needed)
   ```sql
   INSERT INTO categories (name, description)
   VALUES ('Your Category', 'Description of your category');
   ```

3. **Add Your Product**
   ```sql
   INSERT INTO products (name, description, base_price, category_id, image_url)
   VALUES (
     'Your Product Name',
     'Product description',
     999.99,
     'your-category-id',
     'https://your-image-url.com/image.jpg'
   );
   ```

4. **Add Configuration Options**
   ```sql
   INSERT INTO config_options (name, product_id, option_type, is_required, display_order)
   VALUES (
     'Color',
     'your-product-id',
     'selection',
     true,
     1
   );
   ```

5. **Add Option Values**
   ```sql
   INSERT INTO option_values (name, config_option_id, price_modifier, hex_color, display_order)
   VALUES 
   ('Red', 'your-option-id', 0, '#ff0000', 1),
   ('Blue', 'your-option-id', 50, '#0000ff', 2);
   ```

### Configuration Option Types

ConfigureMax supports several option types:
- **Selection**: Single choice from multiple options
- **Color**: Color picker with hex values
- **Size**: Numerical or text-based sizing
- **Feature**: Boolean on/off features
- **Quantity**: Numerical input for quantities

## Step 5: Brand Customization

### Update Branding
Edit `src/components/HeroSection.tsx` to customize:
- Company name and tagline
- Hero messaging
- Call-to-action buttons
- Color scheme

### Design System
The app uses a design token system in:
- `src/index.css` - Color variables and gradients
- `tailwind.config.ts` - Theme configuration

### Key Customization Points
```css
/* src/index.css */
:root {
  --primary: your-brand-color-hsl;
  --accent: your-accent-color-hsl;
  --gradient-primary: your-brand-gradient;
}
```

## Step 6: Deploy to Production

### Quick Deployment with Lovable
1. Connect your GitHub repository to Lovable
2. Click "Deploy to Production"
3. Your configurator will be live with SSL and global CDN

### Manual Deployment
ConfigureMax works with any static hosting provider:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront

Build command: `npm run build`
Output directory: `dist`

## Next Steps

Now that you have Open Configurator running with advanced features:

1. **Add Your Products**: Replace sample data with your actual products and 3D models
2. **Configure Business Rules**: Set up validation rules and constraints in the rule engine
3. **Set Up Dynamic Pricing**: Configure volume discounts and conditional pricing rules
4. **Customize 3D Models**: Add your product 3D models and configuration mappings
5. **Train AI Recommendations**: Configure recommendation algorithms for your product types
6. **Customize Design**: Update colors, fonts, and branding to match your company
7. **Configure Analytics**: Set up conversion tracking and performance monitoring
8. **Add Payment Integration**: Integrate with Stripe, PayPal, or your payment provider
9. **Deploy to Production**: Launch your configurator with all advanced features

## Need Help?

- 📖 [Full Documentation](./README.md)
- 🐛 [Report Issues](https://github.com/your-username/configuremax/issues)
- 💬 [Community Discord](https://discord.gg/configuremax)
- 📧 [Email Support](mailto:support@configuremax.com)

## ⚠️ CRITICAL SECURITY NOTICE

**IMPORTANT**: The current implementation has several security vulnerabilities that MUST be addressed before production deployment:

### 🔴 Critical Issues

1. **Exposed Business Logic**: Pricing rules, configuration rules, and inventory levels are publicly readable, exposing your competitive pricing strategy and stock levels to anyone.

2. **Client-Side Security Enforcement**: All rule validation and pricing calculations happen in the browser and can be bypassed by malicious users.

3. **Missing Input Validation**: User inputs are not validated, risking data corruption or injection attacks.

### ✅ Required Security Fixes

Before going to production, you MUST:

1. **Move Business Logic Server-Side**: 
   - Create Supabase Edge Functions for rule validation and pricing
   - Validate all configurations server-side before saving
   
2. **Restrict Database Access**:
   - Implement admin-only policies for `pricing_rules`, `configuration_rules`, and `inventory_levels`
   - Add proper authentication and authorization

3. **Add Input Validation**:
   - Implement Zod schemas for all user inputs
   - Validate data before database insertion

4. **Secure Session Management**:
   - Replace predictable session IDs with crypto-secure UUIDs
   - Implement proper session expiration

### 📖 Security Resources

- [Open Configurator Security Guide](./security.md)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Common Issues

### Database Connection Issues
- Verify your Supabase URL and anon key
- Check that RLS policies are properly configured
- Ensure your Supabase project is active

### Configuration Not Saving
- Verify the `product_configurations` table has proper insert permissions
- Check browser console for JavaScript errors
- Confirm all required fields are completed

### Styling Issues
- Clear browser cache after CSS changes
- Check that Tailwind classes are properly applied
- Verify color variables are defined in `index.css`

Ready to build something amazing? Let's configure your perfect product experience! 🚀