-- Add option values for Electronics
INSERT INTO option_values (config_option_id, name, price_modifier, hex_color, display_order) VALUES
-- Smartphone colors (using the first smartphone product)
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Smartphone%' AND co.name = 'Color' LIMIT 1), 'Space Black', 0, '#1a1a1a', 1),
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Smartphone%' AND co.name = 'Color' LIMIT 1), 'Silver', 0, '#c0c0c0', 2),
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Smartphone%' AND co.name = 'Color' LIMIT 1), 'Gold', 100, '#ffd700', 3),

-- Smartphone storage
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Smartphone%' AND co.name = 'Storage' LIMIT 1), '128GB', 0, null, 1),
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Smartphone%' AND co.name = 'Storage' LIMIT 1), '256GB', 200, null, 2),
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Smartphone%' AND co.name = 'Storage' LIMIT 1), '512GB', 400, null, 3),

-- Gaming Laptop colors
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Gaming%' AND co.name = 'Color' LIMIT 1), 'Black', 0, '#000000', 1),
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Gaming%' AND co.name = 'Color' LIMIT 1), 'Silver', 0, '#c0c0c0', 2),

-- Gaming Laptop RAM
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Gaming%' AND co.name = 'RAM' LIMIT 1), '16GB', 0, null, 1),
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Gaming%' AND co.name = 'RAM' LIMIT 1), '32GB', 300, null, 2),

-- Headphones colors
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Headphones%' AND co.name = 'Color' LIMIT 1), 'Black', 0, '#000000', 1),
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Headphones%' AND co.name = 'Color' LIMIT 1), 'White', 0, '#ffffff', 2),

-- Sofa fabric options
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Sofa%' AND co.name = 'Fabric' LIMIT 1), 'Cotton Blend', 0, null, 1),
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Sofa%' AND co.name = 'Fabric' LIMIT 1), 'Linen', 200, null, 2),

-- Sports Car colors
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Sports Car%' AND co.name = 'Color' LIMIT 1), 'Racing Red', 0, '#cc0000', 1),
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Sports Car%' AND co.name = 'Color' LIMIT 1), 'Midnight Black', 0, '#000000', 2),

-- Electric SUV colors
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Electric SUV%' AND co.name = 'Color' LIMIT 1), 'Arctic White', 0, '#ffffff', 1),
((SELECT id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name LIKE '%Electric SUV%' AND co.name = 'Color' LIMIT 1), 'Deep Blue', 1000, '#003366', 2);