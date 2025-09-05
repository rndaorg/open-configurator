-- Add configuration options for Electronics products
INSERT INTO config_options (product_id, name, option_type, is_required, display_order) VALUES
-- Smartphone options
((SELECT id FROM products WHERE name = 'Smartphone Pro Max'), 'Color', 'color', true, 1),
((SELECT id FROM products WHERE name = 'Smartphone Pro Max'), 'Storage', 'size', true, 2),
((SELECT id FROM products WHERE name = 'Smartphone Pro Max'), 'Case', 'accessory', false, 3),

-- Gaming Laptop options
((SELECT id FROM products WHERE name = 'Gaming Laptop'), 'Color', 'color', true, 1),
((SELECT id FROM products WHERE name = 'Gaming Laptop'), 'RAM', 'size', true, 2),
((SELECT id FROM products WHERE name = 'Gaming Laptop'), 'Storage', 'size', true, 3),

-- Headphones options
((SELECT id FROM products WHERE name = 'Wireless Headphones'), 'Color', 'color', true, 1),
((SELECT id FROM products WHERE name = 'Wireless Headphones'), 'Case Type', 'accessory', false, 2);

-- Add configuration options for Furniture products
INSERT INTO config_options (product_id, name, option_type, is_required, display_order) VALUES
-- Sectional Sofa options
((SELECT id FROM products WHERE name = 'Modern Sectional Sofa'), 'Fabric', 'material', true, 1),
((SELECT id FROM products WHERE name = 'Modern Sectional Sofa'), 'Color', 'color', true, 2),

-- Dining Table options
((SELECT id FROM products WHERE name = 'Dining Table Set'), 'Material', 'material', true, 1),
((SELECT id FROM products WHERE name = 'Dining Table Set'), 'Finish', 'color', true, 2),

-- Office Chair options
((SELECT id FROM products WHERE name = 'Executive Office Chair'), 'Leather Type', 'material', true, 1),
((SELECT id FROM products WHERE name = 'Executive Office Chair'), 'Color', 'color', true, 2);

-- Add configuration options for Automotive products
INSERT INTO config_options (product_id, name, option_type, is_required, display_order) VALUES
-- Sports Car options
((SELECT id FROM products WHERE name = 'Sports Car'), 'Color', 'color', true, 1),
((SELECT id FROM products WHERE name = 'Sports Car'), 'Interior', 'material', true, 2),
((SELECT id FROM products WHERE name = 'Sports Car'), 'Wheels', 'accessory', false, 3),

-- Electric SUV options
((SELECT id FROM products WHERE name = 'Electric SUV'), 'Color', 'color', true, 1),
((SELECT id FROM products WHERE name = 'Electric SUV'), 'Battery Range', 'feature', true, 2),

-- Motorcycle options
((SELECT id FROM products WHERE name = 'Sport Motorcycle'), 'Color', 'color', true, 1),
((SELECT id FROM products WHERE name = 'Sport Motorcycle'), 'Exhaust System', 'accessory', false, 2);