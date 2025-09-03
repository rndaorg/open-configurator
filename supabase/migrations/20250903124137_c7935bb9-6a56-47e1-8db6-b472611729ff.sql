-- Create product categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create configuration options table (e.g., "Color", "Size", "Accessories")
CREATE TABLE public.config_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('color', 'size', 'accessory', 'feature', 'material')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create option values table (e.g., "Red", "Blue", "Large", "Small")
CREATE TABLE public.option_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_option_id UUID REFERENCES public.config_options(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_modifier DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  hex_color TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product configurations table (saved/ordered configurations)
CREATE TABLE public.product_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  configuration_name TEXT,
  total_price DECIMAL(10,2) NOT NULL,
  configuration_data JSONB NOT NULL, -- Store selected options
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies (public read access for products, authenticated users can save configurations)
CREATE POLICY "Categories are viewable by everyone" 
ON public.categories FOR SELECT USING (true);

CREATE POLICY "Products are viewable by everyone" 
ON public.products FOR SELECT USING (true);

CREATE POLICY "Config options are viewable by everyone" 
ON public.config_options FOR SELECT USING (true);

CREATE POLICY "Option values are viewable by everyone" 
ON public.option_values FOR SELECT USING (true);

CREATE POLICY "Anyone can view product configurations" 
ON public.product_configurations FOR SELECT USING (true);

CREATE POLICY "Anyone can create product configurations" 
ON public.product_configurations FOR INSERT WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_config_options_product_id ON public.config_options(product_id);
CREATE INDEX idx_option_values_config_option_id ON public.option_values(config_option_id);
CREATE INDEX idx_product_configurations_product_id ON public.product_configurations(product_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_configurations_updated_at
  BEFORE UPDATE ON public.product_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
INSERT INTO public.categories (name, description, image_url) VALUES
('Bicycles', 'Custom bicycles with premium components', 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=500'),
('Electric Generators', 'Custom power generation solutions', 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=500');

-- Insert sample products
INSERT INTO public.products (category_id, name, description, base_price, image_url) VALUES
((SELECT id FROM public.categories WHERE name = 'Bicycles'), 'Mountain Explorer', 'Premium mountain bike with advanced suspension', 1299.00, 'https://images.unsplash.com/photo-1544191696-15693ce19ad8?w=500'),
((SELECT id FROM public.categories WHERE name = 'Bicycles'), 'Road Speedster', 'Lightweight carbon fiber road bike', 1899.00, 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=500'),
((SELECT id FROM public.categories WHERE name = 'Electric Generators'), 'PowerMax 5000', 'Reliable 5kW portable generator', 2499.00, 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=500');