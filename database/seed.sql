USE wifi_voucher;

INSERT INTO voucher_plans (name, description, price, duration_minutes, data_limit, is_active)
VALUES
  ('4 Hours Internet', 'Fast Wi-Fi access for up to 4 hours.', 20.00, 240, 'Unlimited', 1),
  ('8 Hours Internet', 'Extended use with a full day of connectivity.', 35.00, 480, 'Unlimited', 1),
  ('24 Hours Internet', 'Best for overnight connectivity.', 60.00, 1440, 'Unlimited', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  price = VALUES(price),
  duration_minutes = VALUES(duration_minutes),
  data_limit = VALUES(data_limit),
  is_active = VALUES(is_active);
