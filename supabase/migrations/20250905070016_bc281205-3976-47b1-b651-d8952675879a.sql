-- Add some basic option values for the new products
INSERT INTO option_values (config_option_id, name, price_modifier, hex_color, display_order) VALUES
-- Smartphone colors 
((SELECT co.id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name = 'Smartphone Pro Max' AND co.name = 'Color'), 'Space Black', 0, '#1a1a1a', 1),
((SELECT co.id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name = 'Smartphone Pro Max' AND co.name = 'Color'), 'Silver', 0, '#c0c0c0', 2),

-- Smartphone storage
((SELECT co.id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name = 'Smartphone Pro Max' AND co.name = 'Storage'), '128GB', 0, null, 1),
((SELECT co.id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name = 'Smartphone Pro Max' AND co.name = 'Storage'), '256GB', 200, null, 2),

-- Gaming Laptop colors
((SELECT co.id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name = 'Gaming Laptop' AND co.name = 'Color'), 'Black', 0, '#000000', 1),
((SELECT co.id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name = 'Gaming Laptop' AND co.name = 'Color'), 'Silver', 0, '#c0c0c0', 2),

-- Gaming Laptop RAM
((SELECT co.id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name = 'Gaming Laptop' AND co.name = 'RAM'), '16GB', 0, null, 1),
((SELECT co.id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name = 'Gaming Laptop' AND co.name = 'RAM'), '32GB', 300, null, 2),

-- Headphones colors
((SELECT co.id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name = 'Wireless Headphones' AND co.name = 'Color'), 'Black', 0, '#000000', 1),
((SELECT co.id FROM config_options co 
  JOIN products p ON co.product_id = p.id 
  WHERE p.name = 'Wireless Headphones' AND co.name = 'Color'), 'White', 0, '#ffffff', 2);