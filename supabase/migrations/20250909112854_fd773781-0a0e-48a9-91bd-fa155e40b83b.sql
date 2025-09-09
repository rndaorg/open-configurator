-- Add comprehensive pricing rules data
INSERT INTO pricing_rules (rule_name, rule_type, product_id, discount_type, discount_value, min_quantity, conditions, valid_from, valid_until) VALUES
-- Bulk discount rules
('Laptop Bulk Discount', 'bulk_discount', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 'percentage', 10.00, 3, '{"applies_to": "all"}', now(), now() + interval '1 year'),
('Smartphone Early Bird', 'time_based', (SELECT id FROM products WHERE name = 'Smartphone Pro'), 'percentage', 15.00, 1, '{"time_of_day": "morning"}', now(), now() + interval '6 months'),
('Premium Configuration Discount', 'configuration_based', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 'fixed', 200.00, 1, '{"requires_options": ["32GB RAM", "1TB SSD"]}', now(), now() + interval '3 months'),

-- Volume pricing
('Tablet Volume Pricing', 'volume', (SELECT id FROM products WHERE name = 'Tablet Ultra'), 'percentage', 8.00, 5, '{"volume_tiers": [{"min": 5, "discount": 8}, {"min": 10, "discount": 15}]}', now(), now() + interval '1 year'),
('Headset Bundle Deal', 'bundle', (SELECT id FROM products WHERE name = 'Gaming Headset'), 'percentage', 20.00, 1, '{"bundle_with": ["gaming_mouse", "keyboard"]}', now(), now() + interval '2 months'),

-- Seasonal pricing
('Summer Sale Laptop', 'seasonal', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 'percentage', 12.00, 1, '{"season": "summer", "customer_segment": "student"}', now(), now() + interval '3 months'),
('Back to School Tablet', 'promotional', (SELECT id FROM products WHERE name = 'Tablet Ultra'), 'percentage', 18.00, 1, '{"promotion_code": "SCHOOL2024"}', now(), now() + interval '1 month');

-- Add comprehensive configuration rules data
INSERT INTO configuration_rules (rule_name, rule_type, product_id, conditions, actions, priority) VALUES
-- Dependency rules
('Laptop RAM Storage Dependency', 'dependency', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 
 '{"option_id": "memory", "selected_value": "32GB"}', 
 '{"require_options": [{"option_id": "storage", "min_value": "512GB"}]}', 1),

('High Performance GPU Requirement', 'dependency', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 
 '{"option_id": "gpu", "selected_value": "RTX 4080"}', 
 '{"require_options": [{"option_id": "cooling", "value": "Liquid Cooling"}]}', 2),

-- Restriction rules
('Budget Memory Restriction', 'restriction', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 
 '{"option_id": "memory", "selected_value": "8GB"}', 
 '{"restrict_options": [{"option_id": "gpu", "restricted_values": ["RTX 4080", "RTX 4090"]}]}', 1),

('Smartphone Color Screen Compatibility', 'restriction', (SELECT id FROM products WHERE name = 'Smartphone Pro'), 
 '{"option_id": "color", "selected_value": "Midnight Black"}', 
 '{"restrict_options": [{"option_id": "screen_protector", "restricted_values": ["Clear"]}]}', 1),

-- Auto-selection rules  
('Pro Model Auto Features', 'auto_select', (SELECT id FROM products WHERE name = 'Smartphone Pro'), 
 '{"option_id": "model", "selected_value": "Pro Max"}', 
 '{"auto_select": [{"option_id": "wireless_charging", "value": "Yes"}, {"option_id": "water_resistance", "value": "IP68"}]}', 3),

('Gaming Laptop Auto Cooling', 'auto_select', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 
 '{"option_id": "gpu", "selected_value": "RTX 4090"}', 
 '{"auto_select": [{"option_id": "cooling", "value": "Liquid Cooling"}, {"option_id": "power_supply", "value": "1000W"}]}', 2),

-- Pricing modifier rules
('Premium Color Surcharge', 'pricing_modifier', (SELECT id FROM products WHERE name = 'Smartphone Pro'), 
 '{"option_id": "color", "selected_value": "Rose Gold"}', 
 '{"price_modifier": {"type": "add", "amount": 100}}', 1),

('Tablet Storage Pricing', 'pricing_modifier', (SELECT id FROM products WHERE name = 'Tablet Ultra'), 
 '{"option_id": "storage", "condition": "greater_than", "value": "256GB"}', 
 '{"price_modifier": {"type": "multiply", "factor": 1.15}}', 1),

-- Complex conditional rules
('Enterprise Bundle Logic', 'conditional', (SELECT id FROM products WHERE name = 'Gaming Laptop'), 
 '{"and": [{"option_id": "memory", "min_value": "32GB"}, {"option_id": "storage", "min_value": "1TB"}]}', 
 '{"enable_options": [{"option_id": "enterprise_support", "value": "3 Year Premium"}], "price_modifier": {"type": "subtract", "amount": 500}}', 4);

-- Add more product configurations for testing
INSERT INTO product_configurations (product_id, configuration_name, configuration_data, total_price) VALUES
((SELECT id FROM products WHERE name = 'Gaming Laptop'), 'High-End Gaming Setup', 
 '{"memory": "32GB", "storage": "1TB SSD", "gpu": "RTX 4080", "cooling": "Liquid Cooling", "color": "RGB Black"}', 2299.99),

((SELECT id FROM products WHERE name = 'Gaming Laptop'), 'Budget Gaming Build', 
 '{"memory": "16GB", "storage": "512GB SSD", "gpu": "RTX 4060", "cooling": "Air Cooling", "color": "Matte Black"}', 1599.99),

((SELECT id FROM products WHERE name = 'Smartphone Pro'), 'Pro Max Configuration', 
 '{"model": "Pro Max", "color": "Deep Purple", "storage": "512GB", "wireless_charging": "Yes", "screen_protector": "Premium"}', 1299.99),

((SELECT id FROM products WHERE name = 'Tablet Ultra'), 'Professional Artist Setup', 
 '{"screen_size": "12.9 inch", "storage": "1TB", "connectivity": "5G + WiFi", "accessories": "Apple Pencil Pro", "color": "Space Gray"}', 1899.99),

((SELECT id FROM products WHERE name = 'Gaming Headset'), 'Streaming Pro Setup', 
 '{"audio_quality": "Hi-Res", "microphone": "Studio Grade", "connectivity": "Wireless + Wired", "color": "RGB Black", "noise_cancellation": "Active"}', 399.99);

-- Add user preferences data for recommendation testing
INSERT INTO user_preferences (user_id, product_id, preferences, interaction_score) VALUES
(gen_random_uuid(), (SELECT id FROM products WHERE name = 'Gaming Laptop'), 
 '{"preferred_brands": ["ASUS", "MSI"], "budget_range": [1500, 2500], "use_case": "gaming", "performance_priority": "high"}', 85.5),

(gen_random_uuid(), (SELECT id FROM products WHERE name = 'Smartphone Pro'), 
 '{"preferred_features": ["camera", "battery"], "color_preference": ["black", "blue"], "storage_needs": "high"}', 72.3),

(gen_random_uuid(), (SELECT id FROM products WHERE name = 'Tablet Ultra'), 
 '{"use_case": "professional", "screen_size": "large", "accessories": ["pencil", "keyboard"]}', 91.2);

-- Add configuration analytics data for testing
INSERT INTO configuration_analytics (product_id, session_id, configuration_data, completion_rate, abandonment_point, user_agent) VALUES
((SELECT id FROM products WHERE name = 'Gaming Laptop'), 'session_001', 
 '{"step": "memory_selection", "time_spent": 45, "options_viewed": ["16GB", "32GB"]}', 0.75, 'pricing_review', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),

((SELECT id FROM products WHERE name = 'Smartphone Pro'), 'session_002', 
 '{"step": "color_selection", "time_spent": 120, "options_viewed": ["all_colors"]}', 1.0, null, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'),

((SELECT id FROM products WHERE name = 'Tablet Ultra'), 'session_003', 
 '{"step": "storage_selection", "time_spent": 30, "options_viewed": ["256GB", "512GB", "1TB"]}', 0.60, 'add_to_cart', 'Mozilla/5.0 (iPad; CPU OS 17_0)');