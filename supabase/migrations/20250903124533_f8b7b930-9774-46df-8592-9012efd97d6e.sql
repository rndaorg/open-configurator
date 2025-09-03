-- Add configuration options for the Mountain Explorer bike
WITH mountain_bike AS (SELECT id FROM public.products WHERE name = 'Mountain Explorer')
INSERT INTO public.config_options (product_id, name, option_type, is_required, display_order) VALUES
((SELECT id FROM mountain_bike), 'Frame Color', 'color', true, 1),
((SELECT id FROM mountain_bike), 'Wheel Size', 'size', true, 2),
((SELECT id FROM mountain_bike), 'Suspension', 'feature', false, 3),
((SELECT id FROM mountain_bike), 'Accessories', 'accessory', false, 4);

-- Add option values for Mountain Explorer
WITH color_option AS (SELECT id FROM public.config_options WHERE name = 'Frame Color' AND product_id = (SELECT id FROM public.products WHERE name = 'Mountain Explorer'))
INSERT INTO public.option_values (config_option_id, name, price_modifier, hex_color, display_order) VALUES
((SELECT id FROM color_option), 'Matte Black', 0, '#1a1a1a', 1),
((SELECT id FROM color_option), 'Electric Blue', 150, '#0066ff', 2),
((SELECT id FROM color_option), 'Forest Green', 100, '#228b22', 3),
((SELECT id FROM color_option), 'Sunset Orange', 200, '#ff6b35', 4);

WITH wheel_option AS (SELECT id FROM public.config_options WHERE name = 'Wheel Size' AND product_id = (SELECT id FROM public.products WHERE name = 'Mountain Explorer'))
INSERT INTO public.option_values (config_option_id, name, price_modifier, display_order) VALUES
((SELECT id FROM wheel_option), '27.5 inch', 0, 1),
((SELECT id FROM wheel_option), '29 inch', 250, 2);

WITH suspension_option AS (SELECT id FROM public.config_options WHERE name = 'Suspension' AND product_id = (SELECT id FROM public.products WHERE name = 'Mountain Explorer'))
INSERT INTO public.option_values (config_option_id, name, price_modifier, display_order) VALUES
((SELECT id FROM suspension_option), 'Standard', 0, 1),
((SELECT id FROM suspension_option), 'Premium Air Shock', 800, 2),
((SELECT id FROM suspension_option), 'Pro Carbon Fiber', 1500, 3);

WITH accessory_option AS (SELECT id FROM public.config_options WHERE name = 'Accessories' AND product_id = (SELECT id FROM public.products WHERE name = 'Mountain Explorer'))
INSERT INTO public.option_values (config_option_id, name, price_modifier, display_order) VALUES
((SELECT id FROM accessory_option), 'Basic Package', 0, 1),
((SELECT id FROM accessory_option), 'LED Light Kit', 150, 2),
((SELECT id FROM accessory_option), 'GPS Computer', 300, 3),
((SELECT id FROM accessory_option), 'Premium Package', 500, 4);

-- Add configuration options for Road Speedster
WITH road_bike AS (SELECT id FROM public.products WHERE name = 'Road Speedster')
INSERT INTO public.config_options (product_id, name, option_type, is_required, display_order) VALUES
((SELECT id FROM road_bike), 'Frame Material', 'material', true, 1),
((SELECT id FROM road_bike), 'Frame Color', 'color', true, 2),
((SELECT id FROM road_bike), 'Wheel Upgrade', 'feature', false, 3);

-- Add option values for Road Speedster
WITH material_option AS (SELECT id FROM public.config_options WHERE name = 'Frame Material' AND product_id = (SELECT id FROM public.products WHERE name = 'Road Speedster'))
INSERT INTO public.option_values (config_option_id, name, price_modifier, display_order) VALUES
((SELECT id FROM material_option), 'Carbon Fiber', 0, 1),
((SELECT id FROM material_option), 'Premium Carbon', 800, 2),
((SELECT id FROM material_option), 'Ultra-Light Carbon', 1600, 3);

WITH road_color_option AS (SELECT id FROM public.config_options WHERE name = 'Frame Color' AND product_id = (SELECT id FROM public.products WHERE name = 'Road Speedster'))
INSERT INTO public.option_values (config_option_id, name, price_modifier, hex_color, display_order) VALUES
((SELECT id FROM road_color_option), 'Racing Red', 0, '#dc2626', 1),
((SELECT id FROM road_color_option), 'Pearl White', 100, '#fafafa', 2),
((SELECT id FROM road_color_option), 'Deep Navy', 150, '#1e3a8a', 3);

WITH wheel_upgrade_option AS (SELECT id FROM public.config_options WHERE name = 'Wheel Upgrade' AND product_id = (SELECT id FROM public.products WHERE name = 'Road Speedster'))
INSERT INTO public.option_values (config_option_id, name, price_modifier, display_order) VALUES
((SELECT id FROM wheel_upgrade_option), 'Standard Wheels', 0, 1),
((SELECT id FROM wheel_upgrade_option), 'Aero Wheels', 1200, 2),
((SELECT id FROM wheel_upgrade_option), 'Carbon Fiber Wheels', 2500, 3);

-- Add configuration options for PowerMax 5000 Generator
WITH generator AS (SELECT id FROM public.products WHERE name = 'PowerMax 5000')
INSERT INTO public.config_options (product_id, name, option_type, is_required, display_order) VALUES
((SELECT id FROM generator), 'Power Output', 'feature', true, 1),
((SELECT id FROM generator), 'Fuel Type', 'feature', true, 2),
((SELECT id FROM generator), 'Control Panel', 'feature', false, 3);

-- Add option values for PowerMax 5000
WITH power_option AS (SELECT id FROM public.config_options WHERE name = 'Power Output' AND product_id = (SELECT id FROM public.products WHERE name = 'PowerMax 5000'))
INSERT INTO public.option_values (config_option_id, name, price_modifier, display_order) VALUES
((SELECT id FROM power_option), '5000W Standard', 0, 1),
((SELECT id FROM power_option), '7500W Enhanced', 800, 2),
((SELECT id FROM power_option), '10000W Professional', 1500, 3);

WITH fuel_option AS (SELECT id FROM public.config_options WHERE name = 'Fuel Type' AND product_id = (SELECT id FROM public.products WHERE name = 'PowerMax 5000'))
INSERT INTO public.option_values (config_option_id, name, price_modifier, display_order) VALUES
((SELECT id FROM fuel_option), 'Gasoline', 0, 1),
((SELECT id FROM fuel_option), 'Dual Fuel (Gas/Propane)', 400, 2),
((SELECT id FROM fuel_option), 'Diesel', 600, 3);

WITH control_option AS (SELECT id FROM public.config_options WHERE name = 'Control Panel' AND product_id = (SELECT id FROM public.products WHERE name = 'PowerMax 5000'))
INSERT INTO public.option_values (config_option_id, name, price_modifier, display_order) VALUES
((SELECT id FROM control_option), 'Manual Start', 0, 1),
((SELECT id FROM control_option), 'Electric Start', 300, 2),
((SELECT id FROM control_option), 'Smart Remote Control', 800, 3);