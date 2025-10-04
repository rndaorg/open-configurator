-- Add comprehensive pricing rules data with valid rule types
INSERT INTO pricing_rules (rule_name, rule_type, product_id, discount_type, discount_value, min_quantity, conditions, valid_from, valid_until) VALUES
-- Volume discount rules
('Laptop Volume Discount', 'volume_discount', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 'percentage', 10.00, 3, '{"applies_to": "all"}', now(), now() + interval '1 year'),
('Smartphone Volume Deal', 'volume_discount', (SELECT id FROM products WHERE name = 'Smartphone Pro'), 'percentage', 15.00, 2, '{"volume_tiers": [{"min": 2, "discount": 15}, {"min": 5, "discount": 25}]}', now(), now() + interval '6 months'),
('Tablet Bulk Pricing', 'volume_discount', (SELECT id FROM products WHERE name = 'Tablet Ultra'), 'percentage', 8.00, 5, '{"volume_tiers": [{"min": 5, "discount": 8}, {"min": 10, "discount": 15}]}', now(), now() + interval '1 year'),

-- Time-based pricing
('Morning Early Bird', 'time_based', (SELECT id FROM products WHERE name = 'Smartphone Pro'), 'percentage', 12.00, 1, '{"time_of_day": "morning", "hours": ["06:00", "10:00"]}', now(), now() + interval '6 months'),
('Weekend Special', 'time_based', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 'fixed_amount', 200.00, 1, '{"days_of_week": ["saturday", "sunday"]}', now(), now() + interval '3 months'),
('Happy Hour Tablet', 'time_based', (SELECT id FROM products WHERE name = 'Tablet Ultra'), 'percentage', 18.00, 1, '{"time_of_day": "evening", "hours": ["17:00", "19:00"]}', now(), now() + interval '2 months'),

-- Bundle deals
('Headset Bundle Deal', 'bundle', (SELECT id FROM products WHERE name = 'Gaming Headset'), 'percentage', 20.00, 1, '{"bundle_with": ["gaming_mouse", "keyboard"]}', now(), now() + interval '2 months'),
('Laptop Accessory Bundle', 'bundle', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 'fixed_amount', 150.00, 1, '{"bundle_with": ["mouse", "headset", "mouse_pad"]}', now(), now() + interval '3 months'),

-- Conditional pricing
('Premium Config Discount', 'conditional', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 'fixed_amount', 300.00, 1, '{"requires_options": {"memory": "32GB", "storage": "1TB"}}', now(), now() + interval '3 months'),
('Student Discount', 'conditional', (SELECT id FROM products WHERE name = 'Tablet Ultra'), 'percentage', 20.00, 1, '{"customer_segment": "student", "verification_required": true}', now(), now() + interval '1 year');

-- Add comprehensive configuration rules data (using only valid rule types)
INSERT INTO configuration_rules (rule_name, rule_type, product_id, conditions, actions, priority) VALUES
-- Dependency rules
('Laptop RAM Storage Dependency', 'dependency', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 
 '{"option_id": "memory", "selected_value": "32GB"}', 
 '{"require_options": [{"option_id": "storage", "min_value": "512GB"}]}', 1),

('High Performance GPU Requirement', 'dependency', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 
 '{"option_id": "gpu", "selected_value": "RTX 4080"}', 
 '{"require_options": [{"option_id": "cooling", "value": "Liquid Cooling"}]}', 2),

('Tablet Accessory Dependency', 'dependency', (SELECT id FROM products WHERE name = 'Tablet Ultra'), 
 '{"option_id": "accessories", "selected_value": "Apple Pencil Pro"}', 
 '{"require_options": [{"option_id": "screen_protector", "value": "Matte"}]}', 1),

-- Restriction rules
('Budget Memory Restriction', 'restriction', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 
 '{"option_id": "memory", "selected_value": "8GB"}', 
 '{"restrict_options": [{"option_id": "gpu", "restricted_values": ["RTX 4080", "RTX 4090"]}]}', 1),

('Smartphone Color Screen Compatibility', 'restriction', (SELECT id FROM products WHERE name = 'Smartphone Pro'), 
 '{"option_id": "color", "selected_value": "Midnight Black"}', 
 '{"restrict_options": [{"option_id": "screen_protector", "restricted_values": ["Clear"]}]}', 1),

('Storage Connectivity Restriction', 'restriction', (SELECT id FROM products WHERE name = 'Tablet Ultra'), 
 '{"option_id": "storage", "max_value": "128GB"}', 
 '{"restrict_options": [{"option_id": "connectivity", "restricted_values": ["5G + WiFi"]}]}', 2),

-- Auto-selection rules  
('Pro Model Auto Features', 'auto_select', (SELECT id FROM products WHERE name = 'Smartphone Pro'), 
 '{"option_id": "model", "selected_value": "Pro Max"}', 
 '{"auto_select": [{"option_id": "wireless_charging", "value": "Yes"}, {"option_id": "water_resistance", "value": "IP68"}]}', 3),

('Gaming Laptop Auto Cooling', 'auto_select', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 
 '{"option_id": "gpu", "selected_value": "RTX 4090"}', 
 '{"auto_select": [{"option_id": "cooling", "value": "Liquid Cooling"}, {"option_id": "power_supply", "value": "1000W"}]}', 2),

('Headset Premium Auto Features', 'auto_select', (SELECT id FROM products WHERE name = 'Gaming Headset'), 
 '{"option_id": "audio_quality", "selected_value": "Hi-Res"}', 
 '{"auto_select": [{"option_id": "microphone", "value": "Studio Grade"}]}', 1),

-- Pricing rules
('Premium Color Surcharge', 'pricing', (SELECT id FROM products WHERE name = 'Smartphone Pro'), 
 '{"option_id": "color", "selected_value": "Rose Gold"}', 
 '{"price_modifier": {"type": "add", "amount": 100}}', 1),

('Tablet Storage Pricing', 'pricing', (SELECT id FROM products WHERE name = 'Tablet Ultra'), 
 '{"option_id": "storage", "condition": "greater_than", "value": "256GB"}', 
 '{"price_modifier": {"type": "multiply", "factor": 1.15}}', 1),

('Enterprise Bundle Pricing', 'pricing', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 
 '{"and": [{"option_id": "memory", "min_value": "32GB"}, {"option_id": "storage", "min_value": "1TB"}]}', 
 '{"price_modifier": {"type": "subtract", "amount": 500}}', 4);

-- Add product configurations
INSERT INTO product_configurations (product_id, configuration_name, configuration_data, total_price) VALUES
((SELECT id FROM products WHERE name = 'Gaming Laptop'), 'High-End Gaming Setup', 
 '{"memory": "32GB", "storage": "1TB SSD", "gpu": "RTX 4080", "cooling": "Liquid Cooling", "color": "RGB Black"}', 2299.99),

((SELECT id FROM products WHERE name = 'Gaming Laptop'), 'Budget Gaming Build', 
 '{"memory": "16GB", "storage": "512GB SSD", "gpu": "RTX 4060", "cooling": "Air Cooling", "color": "Matte Black"}', 1599.99),

((SELECT id FROM products WHERE name = 'Smartphone Pro'), 'Pro Max Configuration', 
 '{"model": "Pro Max", "color": "Deep Purple", "storage": "512GB", "wireless_charging": "Yes"}', 1299.99),

((SELECT id FROM products WHERE name = 'Tablet Ultra'), 'Professional Artist Setup', 
 '{"screen_size": "12.9 inch", "storage": "1TB", "connectivity": "5G + WiFi", "accessories": "Apple Pencil Pro"}', 1899.99);

-- Add user preferences
INSERT INTO user_preferences (user_id, product_id, preferences, interaction_score) VALUES
(gen_random_uuid(), (SELECT id FROM products WHERE name = 'Gaming Laptop'), 
 '{"preferred_brands": ["ASUS", "MSI"], "budget_range": [1500, 2500], "use_case": "gaming"}', 85.5),

(gen_random_uuid(), (SELECT id FROM products WHERE name = 'Smartphone Pro'), 
 '{"preferred_features": ["camera", "battery"], "color_preference": ["black", "blue"]}', 72.3);

-- Add configuration analytics
INSERT INTO configuration_analytics (product_id, session_id, configuration_data, completion_rate, abandonment_point, user_agent) VALUES
((SELECT id FROM products WHERE name = 'Gaming Laptop'), 'session_001', 
 '{"step": "memory_selection", "time_spent": 45, "options_viewed": ["16GB", "32GB"]}', 0.75, 'pricing_review', 'Mozilla/5.0 (Windows NT 10.0)'),

((SELECT id FROM products WHERE name = 'Smartphone Pro'), 'session_002', 
 '{"step": "color_selection", "time_spent": 120, "options_viewed": ["all_colors"]}', 1.0, null, 'Mozilla/5.0 (iPhone)');