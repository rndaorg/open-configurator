-- Add pricing rules for Bicycles, Electric Generators, and Automotive products

-- Mountain Explorer (Bicycle) pricing rules
INSERT INTO pricing_rules (product_id, rule_name, rule_type, discount_type, conditions, discount_value, min_quantity, is_active) VALUES
((SELECT id FROM products WHERE name = 'Mountain Explorer'), 'Volume Discount - 5+ bikes', 'volume_discount', 'percentage', '{"min_quantity": 5}', 10.0, 5, true),
((SELECT id FROM products WHERE name = 'Mountain Explorer'), 'Bundle - Full Suspension Package', 'bundle', 'fixed_amount', '{"required_options": {"suspension": "Full Suspension", "accessories": "Bike Computer"}}', 150.0, 1, true),
((SELECT id FROM products WHERE name = 'Mountain Explorer'), 'Early Bird Special', 'time_based', 'percentage', '{"hour_start": 6, "hour_end": 10}', 5.0, 1, true);

-- Road Speedster (Bicycle) pricing rules
INSERT INTO pricing_rules (product_id, rule_name, rule_type, discount_type, conditions, discount_value, min_quantity, is_active) VALUES
((SELECT id FROM products WHERE name = 'Road Speedster'), 'Carbon Frame Upgrade Bundle', 'bundle', 'fixed_amount', '{"required_options": {"frame_material": "Carbon Fiber", "wheel_upgrade": "Carbon Wheels"}}', 200.0, 1, true),
((SELECT id FROM products WHERE name = 'Road Speedster'), 'Team Orders Discount', 'volume_discount', 'percentage', '{"min_quantity": 10}', 15.0, 10, true),
((SELECT id FROM products WHERE name = 'Road Speedster'), 'Weekend Special', 'time_based', 'percentage', '{"day_of_week": [6, 0]}', 7.0, 1, true);

-- PowerMax 5000 (Generator) pricing rules
INSERT INTO pricing_rules (product_id, rule_name, rule_type, discount_type, conditions, discount_value, min_quantity, is_active) VALUES
((SELECT id FROM products WHERE name = 'PowerMax 5000'), 'Dual Fuel Discount', 'bundle', 'fixed_amount', '{"required_options": {"fuel_type": "Dual Fuel"}}', 100.0, 1, true),
((SELECT id FROM products WHERE name = 'PowerMax 5000'), 'Commercial Order Discount', 'volume_discount', 'percentage', '{"min_quantity": 3}', 12.0, 3, true),
((SELECT id FROM products WHERE name = 'PowerMax 5000'), 'Smart Control Bundle', 'bundle', 'percentage', '{"required_options": {"control_panel": "Smart WiFi Control"}}', 8.0, 1, true);

-- Sports Car (Automotive) pricing rules
INSERT INTO pricing_rules (product_id, rule_name, rule_type, discount_type, conditions, discount_value, min_quantity, is_active) VALUES
((SELECT id FROM products WHERE name = 'Sports Car'), 'Premium Package Bundle', 'bundle', 'fixed_amount', '{"required_options": {"interior": "Premium Leather", "wheels": "Forged Alloy"}}', 2500.0, 1, true),
((SELECT id FROM products WHERE name = 'Sports Car'), 'Fleet Purchase Discount', 'volume_discount', 'percentage', '{"min_quantity": 2}', 5.0, 2, true),
((SELECT id FROM products WHERE name = 'Sports Car'), 'End of Month Special', 'time_based', 'percentage', '{"day_of_month_start": 25, "day_of_month_end": 31}', 3.0, 1, true);

-- Sport Motorcycle (Automotive) pricing rules
INSERT INTO pricing_rules (product_id, rule_name, rule_type, discount_type, conditions, discount_value, min_quantity, is_active) VALUES
((SELECT id FROM products WHERE name = 'Sport Motorcycle'), 'Performance Exhaust Bundle', 'bundle', 'fixed_amount', '{"required_options": {"exhaust_system": "Performance Titanium"}}', 300.0, 1, true),
((SELECT id FROM products WHERE name = 'Sport Motorcycle'), 'Riding School Discount', 'volume_discount', 'percentage', '{"min_quantity": 5}', 8.0, 5, true);

-- Car Sound System (Automotive) pricing rules
INSERT INTO pricing_rules (product_id, rule_name, rule_type, discount_type, conditions, discount_value, min_quantity, is_active) VALUES
((SELECT id FROM products WHERE name = 'Car Sound System'), 'Professional Install Bundle', 'bundle', 'percentage', '{"required_options": {"installation": "Professional Install"}}', 10.0, 1, true),
((SELECT id FROM products WHERE name = 'Car Sound System'), 'Multi-Vehicle Discount', 'volume_discount', 'percentage', '{"min_quantity": 3}', 15.0, 3, true);

-- Electric SUV (Automotive) pricing rules
INSERT INTO pricing_rules (product_id, rule_name, rule_type, discount_type, conditions, discount_value, min_quantity, is_active) VALUES
((SELECT id FROM products WHERE name = 'Electric SUV'), 'Early Adopter Discount', 'time_based', 'fixed_amount', '{"valid_until": "2025-12-31"}', 5000.0, 1, true),
((SELECT id FROM products WHERE name = 'Electric SUV'), 'Corporate Fleet Order', 'volume_discount', 'percentage', '{"min_quantity": 5}', 7.0, 5, true);

-- Add configuration rules for validation and dependencies

-- Mountain Explorer configuration rules
INSERT INTO configuration_rules (product_id, rule_name, rule_type, conditions, actions, priority, is_active) VALUES
((SELECT id FROM products WHERE name = 'Mountain Explorer'), 'Full Suspension Requires Premium', 'dependency', '{"option": "suspension", "value": "Full Suspension"}', '{"show_option": "accessories", "recommended_value": "Bike Computer"}', 1, true),
((SELECT id FROM products WHERE name = 'Mountain Explorer'), 'Restrict Small Wheels with Full Suspension', 'restriction', '{"option": "suspension", "value": "Full Suspension"}', '{"disable_option_value": {"option": "wheel_size", "values": ["26 inch"]}}', 2, true),
((SELECT id FROM products WHERE name = 'Mountain Explorer'), 'Auto-select Safety Package', 'auto_select', '{"option": "suspension", "value": "Full Suspension"}', '{"auto_add": {"option": "accessories", "value": "Safety Gear"}}', 3, true);

-- Road Speedster configuration rules
INSERT INTO configuration_rules (product_id, rule_name, rule_type, conditions, actions, priority, is_active) VALUES
((SELECT id FROM products WHERE name = 'Road Speedster'), 'Carbon Frame Requires Carbon Wheels', 'dependency', '{"option": "frame_material", "value": "Carbon Fiber"}', '{"show_option": "wheel_upgrade", "recommended_value": "Carbon Wheels"}', 1, true),
((SELECT id FROM products WHERE name = 'Road Speedster'), 'Aluminum Not Compatible with Carbon Wheels', 'restriction', '{"option": "frame_material", "value": "Aluminum"}', '{"disable_option_value": {"option": "wheel_upgrade", "values": ["Carbon Wheels"]}}', 2, true);

-- PowerMax 5000 configuration rules
INSERT INTO configuration_rules (product_id, rule_name, rule_type, conditions, actions, priority, is_active) VALUES
((SELECT id FROM products WHERE name = 'PowerMax 5000'), 'High Power Requires Smart Control', 'dependency', '{"option": "power_output", "value": "7500W"}', '{"show_option": "control_panel", "recommended_value": "Smart WiFi Control"}', 1, true),
((SELECT id FROM products WHERE name = 'PowerMax 5000'), 'Dual Fuel Premium Pricing', 'pricing', '{"option": "fuel_type", "value": "Dual Fuel"}', '{"price_modifier": 500}', 2, true),
((SELECT id FROM products WHERE name = 'PowerMax 5000'), 'Auto-add Transfer Switch', 'auto_select', '{"option": "control_panel", "value": "Auto Transfer Switch"}', '{"auto_add": {"option": "power_output", "value": "7500W"}}', 3, true);

-- Sports Car configuration rules
INSERT INTO configuration_rules (product_id, rule_name, rule_type, conditions, actions, priority, is_active) VALUES
((SELECT id FROM products WHERE name = 'Sports Car'), 'Premium Interior Requires Forged Wheels', 'dependency', '{"option": "interior", "value": "Premium Leather"}', '{"show_option": "wheels", "recommended_value": "Forged Alloy"}', 1, true),
((SELECT id FROM products WHERE name = 'Sports Car'), 'Restrict Basic Interior with Premium Wheels', 'restriction', '{"option": "wheels", "value": "Forged Alloy"}', '{"disable_option_value": {"option": "interior", "values": ["Standard Cloth"]}}', 2, true),
((SELECT id FROM products WHERE name = 'Sports Car'), 'Performance Package Auto-add', 'auto_select', '{"option": "wheels", "value": "Forged Alloy"}', '{"auto_add": {"option": "interior", "value": "Premium Leather"}}', 3, true);

-- Sport Motorcycle configuration rules
INSERT INTO configuration_rules (product_id, rule_name, rule_type, conditions, actions, priority, is_active) VALUES
((SELECT id FROM products WHERE name = 'Sport Motorcycle'), 'Racing Exhaust Not Street Legal', 'restriction', '{"option": "exhaust_system", "value": "Racing Exhaust"}', '{"warning": "Not street legal in all jurisdictions"}', 1, true),
((SELECT id FROM products WHERE name = 'Sport Motorcycle'), 'Performance Exhaust Premium', 'pricing', '{"option": "exhaust_system", "value": "Performance Titanium"}', '{"price_modifier": 1200}', 2, true);

-- Car Sound System configuration rules
INSERT INTO configuration_rules (product_id, rule_name, rule_type, conditions, actions, priority, is_active) VALUES
((SELECT id FROM products WHERE name = 'Car Sound System'), 'High Power Requires Pro Install', 'dependency', '{"option": "power_rating", "value": "1000W"}', '{"show_option": "installation", "recommended_value": "Professional Install"}', 1, true),
((SELECT id FROM products WHERE name = 'Car Sound System'), 'DIY Kit Restrictions', 'restriction', '{"option": "installation", "value": "DIY Kit"}', '{"disable_option_value": {"option": "power_rating", "values": ["1000W"]}}', 2, true);

-- Add inventory levels for option values (only if not already exists)
INSERT INTO inventory_levels (option_value_id, available_quantity, reserved_quantity, low_stock_threshold)
SELECT ov.id, 
  CASE 
    WHEN ov.name LIKE '%Premium%' OR ov.name LIKE '%Carbon%' THEN 15
    WHEN ov.name LIKE '%Standard%' OR ov.name LIKE '%Basic%' THEN 50
    ELSE 30
  END as available_quantity,
  0 as reserved_quantity,
  CASE 
    WHEN ov.name LIKE '%Premium%' OR ov.name LIKE '%Carbon%' THEN 5
    ELSE 10
  END as low_stock_threshold
FROM option_values ov
JOIN config_options co ON ov.config_option_id = co.id
JOIN products p ON co.product_id = p.id
WHERE p.category_id IN (
  (SELECT id FROM categories WHERE name = 'Bicycles'),
  (SELECT id FROM categories WHERE name = 'Electric Generators'),
  (SELECT id FROM categories WHERE name = 'Automotive')
)
AND NOT EXISTS (
  SELECT 1 FROM inventory_levels il WHERE il.option_value_id = ov.id
);