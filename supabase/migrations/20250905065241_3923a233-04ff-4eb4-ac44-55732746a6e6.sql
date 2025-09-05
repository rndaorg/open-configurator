-- Add sample products for Electronics category
INSERT INTO products (name, description, base_price, category_id, image_url, is_active) VALUES
('Smartphone Pro Max', 'Latest flagship smartphone with advanced features', 999.99, (SELECT id FROM categories WHERE name = 'Electronics'), 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop', true),
('Gaming Laptop', 'High-performance gaming laptop with RTX graphics', 1499.99, (SELECT id FROM categories WHERE name = 'Electronics'), 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=400&h=400&fit=crop', true),
('Wireless Headphones', 'Premium noise-canceling wireless headphones', 299.99, (SELECT id FROM categories WHERE name = 'Electronics'), 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop', true);

-- Add sample products for Furniture Store category  
INSERT INTO products (name, description, base_price, category_id, image_url, is_active) VALUES
('Modern Sectional Sofa', 'Comfortable L-shaped sectional sofa for living room', 1299.99, (SELECT id FROM categories WHERE name = 'Furniture Store'), 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=400&fit=crop', true),
('Dining Table Set', 'Elegant dining table with 6 chairs', 899.99, (SELECT id FROM categories WHERE name = 'Furniture Store'), 'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?w=400&h=400&fit=crop', true),
('Executive Office Chair', 'Ergonomic leather executive chair', 599.99, (SELECT id FROM categories WHERE name = 'Furniture Store'), 'https://images.unsplash.com/photo-1541558869434-2840d308329a?w=400&h=400&fit=crop', true);

-- Add sample products for Automotive category
INSERT INTO products (name, description, base_price, category_id, image_url, is_active) VALUES
('Sports Car', 'High-performance sports car with premium features', 45999.99, (SELECT id FROM categories WHERE name = 'Automotive'), 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&h=400&fit=crop', true),
('Electric SUV', 'Eco-friendly electric SUV with advanced technology', 52999.99, (SELECT id FROM categories WHERE name = 'Automotive'), 'https://images.unsplash.com/photo-1570294646112-27ce4f174e38?w=400&h=400&fit=crop', true),
('Sport Motorcycle', 'High-speed sport motorcycle for enthusiasts', 12999.99, (SELECT id FROM categories WHERE name = 'Automotive'), 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=400&fit=crop', true);