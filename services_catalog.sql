-- MGR shared services catalog
-- Run this in Supabase SQL Editor. It is safe to run more than once.

CREATE TABLE IF NOT EXISTS public.services (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  image_url   TEXT,
  price       DECIMAL(10,2) NOT NULL DEFAULT 99,
  rating      DECIMAL(3,2) NOT NULL DEFAULT 4.8,
  description TEXT,
  badge       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_select_all" ON public.services;
CREATE POLICY "services_select_all" ON public.services
  FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "services_write_admin" ON public.services;
CREATE POLICY "services_write_admin" ON public.services
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'webscratch99@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'webscratch99@gmail.com');

INSERT INTO public.services (id, name, category, image_url, price, rating, description, badge, sort_order, is_active)
VALUES
  (1, 'Home Deep Cleaning', 'Cleaning', 'https://images.pexels.com/photos/4108715/pexels-photo-4108715.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.9, 'Full home deep cleaning by professionals with eco-friendly products.', 'Bestseller', 1, TRUE),
  (2, 'AC Service & Repair', 'Appliances', 'https://images.pexels.com/photos/5463575/pexels-photo-5463575.jpeg?auto=compress&cs=tinysrgb&w=600', 5, 4.9, 'Complete AC servicing, gas refilling and repair.', 'Popular', 2, TRUE),
  (3, 'Refrigerator Repair', 'Appliances', 'https://images.pexels.com/photos/9551373/pexels-photo-9551373.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.8, 'Expert fridge repair for all brands - cooling, compressor, gas.', NULL, 3, TRUE),
  (4, 'Washing Machine Repair', 'Appliances', 'https://images.pexels.com/photos/5591581/pexels-photo-5591581.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.7, 'Front load and top load washing machine repair.', NULL, 4, TRUE),
  (5, 'Microwave Repair', 'Appliances', 'https://images.pexels.com/photos/32168944/pexels-photo-32168944.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.6, 'Microwave oven repair and servicing for all brands.', NULL, 5, TRUE),
  (6, 'TV & Electronics Repair', 'Appliances', 'https://images.pexels.com/photos/1432669/pexels-photo-1432669.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.7, 'LED, LCD and Smart TV repair at your doorstep.', NULL, 6, TRUE),
  (7, 'Plumbing Repair', 'Plumbing', 'https://images.pexels.com/photos/6419128/pexels-photo-6419128.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.9, 'Leak fixing, pipe repair and installation.', 'Fast', 7, TRUE),
  (8, 'Tap & Faucet Repair', 'Plumbing', 'https://images.pexels.com/photos/4153144/pexels-photo-4153144.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.8, 'Tap replacement, faucet repair and fitting.', NULL, 8, TRUE),
  (9, 'Bathroom Fitting', 'Plumbing', 'https://images.pexels.com/photos/8134822/pexels-photo-8134822.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.8, 'Complete bathroom fitting - showers, geysers, sanitary ware.', NULL, 9, TRUE),
  (10, 'Drain Unclogging', 'Plumbing', 'https://images.pexels.com/photos/4239115/pexels-photo-4239115.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.7, 'Drain and pipeline blockage removal using professional tools.', NULL, 10, TRUE),
  (11, 'Electrical Repair', 'Electrical', 'https://images.pexels.com/photos/27928762/pexels-photo-27928762.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.9, 'Safe wiring, MCB and electrical repair by certified electricians.', NULL, 11, TRUE),
  (12, 'Fan Installation', 'Electrical', 'https://images.pexels.com/photos/7027844/pexels-photo-7027844.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.8, 'Ceiling and exhaust fan installation and replacement.', NULL, 12, TRUE),
  (13, 'Switch & Socket Repair', 'Electrical', 'https://images.pexels.com/photos/5691602/pexels-photo-5691602.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.7, 'Switchboard and socket repair, replacement and new wiring.', NULL, 13, TRUE),
  (14, 'Light Installation', 'Electrical', 'https://images.pexels.com/photos/7641361/pexels-photo-7641361.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.8, 'LED, smart and decorative light installation.', NULL, 14, TRUE),
  (15, 'Facial & Skincare', 'Beauty', 'https://images.pexels.com/photos/3997993/pexels-photo-3997993.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.9, 'Professional facial, de-tan and cleanup at home.', 'Trending', 15, TRUE),
  (16, 'Haircut & Styling', 'Beauty', 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.8, 'Expert haircut and styling for men and women at doorstep.', NULL, 16, TRUE),
  (17, 'Bridal Makeup', 'Beauty', 'https://images.pexels.com/photos/16799888/pexels-photo-16799888.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.9, 'Complete bridal makeup, mehendi and pre-bridal grooming.', NULL, 17, TRUE),
  (18, 'Waxing & Threading', 'Beauty', 'https://images.pexels.com/photos/6135620/pexels-photo-6135620.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.7, 'Full body waxing, eyebrow threading and shaping.', NULL, 18, TRUE),
  (19, 'Manicure & Pedicure', 'Beauty', 'https://images.pexels.com/photos/34930117/pexels-photo-34930117.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.8, 'Spa-quality nail care, scrub and foot massage at home.', NULL, 19, TRUE),
  (20, 'Massage & Spa', 'Beauty', 'https://images.pexels.com/photos/18120173/pexels-photo-18120173.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.9, 'Relaxing full body massage by certified therapists at home.', 'New', 20, TRUE),
  (21, 'Interior Painting', 'Painting', 'https://images.pexels.com/photos/1669754/pexels-photo-1669754.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.8, 'Professional interior wall painting with premium paints.', NULL, 21, TRUE),
  (22, 'Exterior Painting', 'Painting', 'https://images.pexels.com/photos/209315/pexels-photo-209315.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.7, 'Durable exterior wall and terrace waterproofing painting.', NULL, 22, TRUE),
  (23, 'Wood Polishing', 'Painting', 'https://images.pexels.com/photos/1957477/pexels-photo-1957477.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.8, 'Furniture and floor wood polishing and varnishing.', NULL, 23, TRUE),
  (24, 'Pest Control', 'Pest Control', 'https://images.pexels.com/photos/4099263/pexels-photo-4099263.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.9, 'Complete home pest control for cockroaches, ants and rodents.', NULL, 24, TRUE),
  (25, 'Termite Treatment', 'Pest Control', 'https://images.pexels.com/photos/5029088/pexels-photo-5029088.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.8, 'Pre and post construction anti-termite treatment.', NULL, 25, TRUE),
  (26, 'Furniture Assembly', 'Carpentry', 'https://images.pexels.com/photos/5805494/pexels-photo-5805494.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.8, 'Expert assembly of modular and flat-pack furniture.', NULL, 26, TRUE),
  (27, 'Home Shifting', 'Shifting', 'https://images.pexels.com/photos/4246120/pexels-photo-4246120.jpeg?auto=compress&cs=tinysrgb&w=600', 99, 4.8, 'Complete home shifting with packing, loading and moving.', NULL, 27, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  image_url = EXCLUDED.image_url,
  price = EXCLUDED.price,
  rating = EXCLUDED.rating,
  description = EXCLUDED.description,
  badge = EXCLUDED.badge,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
