# Getting Started with ConfigureMax

Welcome to ConfigureMax! This guide will help you set up and customize your product configurator in under 30 minutes.

## Overview

ConfigureMax is designed to be deployment-ready out of the box while remaining highly customizable. You can have a working product configurator running in minutes, then customize it to match your brand and products.

## Prerequisites

Before you begin, make sure you have:
- Node.js 18 or higher installed
- A Supabase account (free tier works great)
- Basic knowledge of web development (helpful but not required)

## Step 1: Project Setup

### Clone the Repository
```bash
git clone https://github.com/your-username/configuremax.git
cd configuremax
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

ConfigureMax comes with a complete database schema and sample data. The schema includes:

- **Products**: Your main product catalog
- **Categories**: Product organization
- **Config Options**: Customization choices (color, size, features)
- **Option Values**: Specific choices within each option
- **Product Configurations**: Saved customer configurations

### Sample Data Included

The system comes pre-loaded with:
- **Mountain Bike**: Configurable with frame size, color, and accessories
- **Road Bike**: Multiple color options and component choices
- **Portable Generator**: Power output and fuel type options
- **Standby Generator**: Advanced features and sizing options

## Step 3: Run Development Server

```bash
npm run dev
```

Open `http://localhost:5173` in your browser. You should see:
- Beautiful landing page with hero section
- Product catalog with sample products
- Working configurator with real-time pricing

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

Now that you have ConfigureMax running:

1. **Add Your Products**: Replace sample data with your actual products
2. **Customize Design**: Update colors, fonts, and branding
3. **Configure Payment**: Integrate with Stripe, PayPal, or your payment provider
4. **Add Analytics**: Track configuration completion rates and popular options
5. **Extend Features**: Add user accounts, saved configurations, sharing features

## Need Help?

- 📖 [Full Documentation](./README.md)
- 🐛 [Report Issues](https://github.com/your-username/configuremax/issues)
- 💬 [Community Discord](https://discord.gg/configuremax)
- 📧 [Email Support](mailto:support@configuremax.com)

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