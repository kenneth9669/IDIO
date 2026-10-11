-- ==============================================================================
-- IDIO Digital Camera Rental Management System
-- Seed Script: seed.sql (2 Roles: CUSTOMER and ADMIN)
-- Target: PostgreSQL / Supabase
-- Location: Butuan City, Agusan del Norte, Philippines
-- ==============================================================================

-- 1. AUTH USERS & PROFILES
DO $$
DECLARE
  admin_uid UUID := 'a1111111-1111-1111-1111-111111111111';
  cust_uid  UUID := 'c3333333-3333-3333-3333-333333333333';
  res1_id   UUID := 'd4444444-4444-4444-4444-444444444441';
  res2_id   UUID := 'd4444444-4444-4444-4444-444444444442';
  res3_id   UUID := 'd4444444-4444-4444-4444-444444444443';
BEGIN
  -- Insert into auth.users (if supabase auth schema is available)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
    VALUES
      (admin_uid, 'admin@idiocameras.ph', '{"full_name": "Dave Admin (Owner)"}', 'authenticated', 'authenticated'),
      (cust_uid,  'jennelyn.creates@gmail.com', '{"full_name": "Jennelyn Photographer"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Insert into public.profiles
  INSERT INTO public.profiles (
    id, role, full_name, email, phone, avatar_url, barangay, street_address, city, province, id_type, id_number
  ) VALUES
    (
      admin_uid,
      'ADMIN',
      'Dave Admin (Owner)',
      'admin@idiocameras.ph',
      '0917-842-1099',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      'Libertad',
      'Purok 3, J.C. Aquino Highway',
      'Butuan City',
      'Agusan del Norte',
      'Driver''s License',
      'K02-18-094123'
    ),
    (
      cust_uid,
      'CUSTOMER',
      'Jennelyn Photographer',
      'jennelyn.creates@gmail.com',
      '0919-334-8877',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
      'Ampayon',
      'Purok 5, Near Caraga State University',
      'Butuan City',
      'Agusan del Norte',
      'UMID',
      'CRN-0111-9876543-2'
    )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;

  -- 2. DIGITAL CAMERAS FLEET
  INSERT INTO public.digital_cameras (
    id, serial_number, name, brand, model, category, daily_rate_php, security_deposit_php,
    status, condition, specs, description, image_url, package_includes, total_rentals_count
  ) VALUES
    (
      'CAM-001',
      'SN-SONY-A7IV-9921',
      'Sony Alpha 7 IV Mirrorless',
      'Sony',
      'ILCE-7M4',
      'Mirrorless',
      1450.00,
      3000.00,
      'AVAILABLE',
      'Excellent',
      '{
        "sensor": "33.0 MP Full-Frame Exmor R CMOS",
        "megapixels": "33.0 MP",
        "videoResolution": "4K 60p 10-bit 4:2:2 All-Intra",
        "isoRange": "100 - 51,200",
        "lensMountOrKit": "Sony E-Mount (FE 28-70mm f/3.5-5.6 OSS Included)",
        "screen": "3.0-inch 1.03M-dot Vari-angle Touchscreen",
        "connectivity": "Dual-band Wi-Fi, Bluetooth 5.0, USB-C 3.2",
        "batteryLife": "Approx. 580 shots (NP-FZ100)",
        "weight": "658g"
      }'::jsonb,
      'Industry-standard hybrid powerhouse. Ideal for weddings in Butuan City, commercial shoots, event coverage, and high-end video creators.',
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
      '["Sony A7 IV Body + 28-70mm OSS Kit Lens", "2x NP-FZ100 Batteries", "1x 128GB SanDisk Extreme PRO SD Card", "Dual USB-C Charger", "Padded Camera Bag"]'::jsonb,
      28
    ),
    (
      'CAM-002',
      'SN-CANON-R6M2-4820',
      'Canon EOS R6 Mark II Mirrorless',
      'Canon',
      'EOS R6 II',
      'Mirrorless',
      1550.00,
      3500.00,
      'AVAILABLE',
      'Excellent',
      '{
        "sensor": "24.2 MP Full-Frame Dual Pixel CMOS II",
        "megapixels": "24.2 MP",
        "videoResolution": "6K Oversampled 4K 60p Uncropped",
        "isoRange": "100 - 102,400",
        "lensMountOrKit": "Canon RF Mount (RF 24-105mm STM Included)",
        "screen": "3.0-inch 1.62M-dot Fully Articulating LCD",
        "connectivity": "Wi-Fi 2.4/5GHz, Bluetooth 5.0",
        "batteryLife": "Approx. 760 shots (LP-E6NH)",
        "weight": "670g"
      }'::jsonb,
      'Blazing 40 fps electronic burst, exceptional low-light sensitivity, and class-leading Dual Pixel AF II for capturing quick action and events.',
      'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80',
      '["Canon EOS R6 Mark II Body + RF 24-105mm Lens", "2x LP-E6NH Batteries", "1x 128GB Lexar Professional SD Card", "Dedicated Charger", "Shoulder Bag"]'::jsonb,
      22
    ),
    (
      'CAM-003',
      'SN-FUJI-XT5-3312',
      'Fujifilm X-T5 Film Simulation Master',
      'Fujifilm',
      'X-T5 Silver Edition',
      'Mirrorless',
      1250.00,
      2500.00,
      'AVAILABLE',
      'Excellent',
      '{
        "sensor": "40.2 MP APS-C X-Trans CMOS 5 HR",
        "megapixels": "40.2 MP",
        "videoResolution": "6.2K 30p / 4K 60p 10-bit",
        "isoRange": "125 - 12,800",
        "lensMountOrKit": "Fujifilm X-Mount (XF 18-55mm f/2.8-4 OIS Included)",
        "screen": "3.0-inch 1.84M-dot 3-Way Tilting LCD",
        "connectivity": "Wi-Fi, Bluetooth 4.2, Micro HDMI, USB-C",
        "batteryLife": "Approx. 740 shots (NP-W235)",
        "weight": "557g"
      }'::jsonb,
      'Famous for classic vintage dials, breathtaking film simulation color profiles, and ultra-sharp 40MP resolution.',
      'https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?auto=format&fit=crop&w=800&q=80',
      '["Fujifilm X-T5 Body + XF 18-55mm Lens", "2x NP-W235 Batteries", "1x 128GB Kingston Canvas SD Card", "Dual Charging Cradle", "Retro Leather Case"]'::jsonb,
      34
    ),
    (
      'CAM-004',
      'SN-SONY-ZVE10-7711',
      'Sony ZV-E10 Creator Vlog Camera',
      'Sony',
      'ZV-E10 II',
      'Vlog & Creator',
      750.00,
      1500.00,
      'AVAILABLE',
      'Good',
      '{
        "sensor": "24.2 MP APS-C Exmor CMOS",
        "megapixels": "24.2 MP",
        "videoResolution": "4K 30p HDR / Full HD 120p Slow-Mo",
        "isoRange": "100 - 32,000",
        "lensMountOrKit": "Sony E-Mount (E PZ 16-50mm Power Zoom)",
        "screen": "Side-opening Vari-angle LCD Touchscreen",
        "connectivity": "Wi-Fi, Bluetooth, USB-C (Livestreaming)",
        "batteryLife": "Approx. 440 shots (NP-FW50)",
        "weight": "343g"
      }'::jsonb,
      'Engineered specifically for vloggers, content creators, and student projects with Product Showcase and background defocus.',
      'https://images.unsplash.com/photo-1589872307379-0ffdf9829123?auto=format&fit=crop&w=800&q=80',
      '["Sony ZV-E10 Body + 16-50mm PZ Lens", "2x NP-FW50 Batteries", "1x 64GB SanDisk Extreme SD Card", "Furry Deadcat Windscreen", "Travel Pouch"]'::jsonb,
      45
    ),
    (
      'CAM-005',
      'SN-CANON-G7XM3-5590',
      'Canon PowerShot G7 X Mark III Digital Compact',
      'Canon',
      'G7 X Mark III',
      'Compact',
      650.00,
      1500.00,
      'AVAILABLE',
      'Good',
      '{
        "sensor": "20.1 MP 1.0-type Stacked CMOS Sensor",
        "megapixels": "20.1 MP",
        "videoResolution": "Uncropped 4K 30p / FHD 120p",
        "isoRange": "125 - 12,800",
        "lensMountOrKit": "Fixed 24-100mm f/1.8-2.8 Optical Zoom",
        "screen": "3.0-inch 180° Flip-up Touchscreen",
        "connectivity": "Wi-Fi, Bluetooth, Clean HDMI Out",
        "batteryLife": "Approx. 265 shots (NB-13L)",
        "weight": "304g"
      }'::jsonb,
      'Pocket-sized digital compact camera with exceptional low-light f/1.8 lens. Perfect for weekend trips to Lake Mainit and casual events.',
      'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80',
      '["Canon PowerShot G7X Mark III Camera", "2x NB-13L Batteries", "1x 64GB SD Card", "Wall Charger", "Protective Case"]'::jsonb,
      39
    ),
    (
      'CAM-006',
      'SN-NIKON-Z6II-6102',
      'Nikon Z6 II Hybrid Full-Frame',
      'Nikon',
      'Nikon Z6 II',
      'Mirrorless',
      1350.00,
      3000.00,
      'AVAILABLE',
      'Excellent',
      '{
        "sensor": "24.5 MP BSI CMOS Dual EXPEED 6",
        "megapixels": "24.5 MP",
        "videoResolution": "4K UHD 60p / N-Log 10-bit",
        "isoRange": "100 - 51,200",
        "lensMountOrKit": "Nikon Z-Mount (NIKKOR Z 24-70mm f/4 S Included)",
        "screen": "3.2-inch 2.1M-dot Tilting Touch LCD",
        "connectivity": "SnapBridge Wi-Fi & Bluetooth, Dual Slots",
        "batteryLife": "Approx. 410 shots (EN-EL15c)",
        "weight": "705g"
      }'::jsonb,
      'Reliable, rugged weather-sealed construction with dual processors. Delivers impeccable dynamic range and superb ergonomic grip.',
      'https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?auto=format&fit=crop&w=800&q=80',
      '["Nikon Z6 II Body + 24-70mm f/4 S Lens", "2x EN-EL15c Batteries", "1x 128GB SDXC V60 Card", "Quick Charger", "Shoulder Strap"]'::jsonb,
      19
    ),
    (
      'CAM-007',
      'SN-RICOH-GR3X-1904',
      'Ricoh GR IIIx Street Digital Compact',
      'Ricoh',
      'GR IIIx',
      'Compact',
      850.00,
      2000.00,
      'AVAILABLE',
      'Excellent',
      '{
        "sensor": "24.2 MP APS-C CMOS Sensor",
        "megapixels": "24.2 MP",
        "videoResolution": "Full HD 1080 60p",
        "isoRange": "100 - 102,400",
        "lensMountOrKit": "Fixed 40mm f/2.8 High-Res Lens",
        "screen": "3.0-inch 1.037M-dot Capacitive Touch LCD",
        "connectivity": "Wi-Fi, Bluetooth 4.2, USB-C PD",
        "batteryLife": "Approx. 200 shots (DB-110)",
        "weight": "262g (Pocketable)"
      }'::jsonb,
      'Cult-favorite street snapshot camera with large APS-C sensor inside an ultra-slim pocket body.',
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
      '["Ricoh GR IIIx Camera", "2x DB-110 Batteries + USB Dual Charger", "1x 64GB Extreme Pro SD Card", "Wrist Strap & Case"]'::jsonb,
      16
    ),
    (
      'CAM-008',
      'SN-CANON-90D-8840',
      'Canon EOS 90D Digital DSLR',
      'Canon',
      'EOS 90D DSLR',
      'DSLR',
      950.00,
      2000.00,
      'AVAILABLE',
      'Good',
      '{
        "sensor": "32.5 MP APS-C CMOS Sensor",
        "megapixels": "32.5 MP",
        "videoResolution": "Uncropped 4K 30p / FHD 120p",
        "isoRange": "100 - 25,600",
        "lensMountOrKit": "Canon EF Mount (EF-S 18-135mm IS USM Included)",
        "screen": "3.0-inch Vari-angle Touch LCD + Optical Viewfinder",
        "connectivity": "Wi-Fi, Bluetooth, 45-point All Cross-Type AF",
        "batteryLife": "Approx. 1300 shots per charge (LP-E6N)",
        "weight": "701g"
      }'::jsonb,
      'Workhorse digital DSLR camera with massive battery endurance (1,300+ shots) and fast optical viewfinder tracking.',
      'https://images.unsplash.com/photo-1516724562728-afc824a36e84?auto=format&fit=crop&w=800&q=80',
      '["Canon EOS 90D Body + 18-135mm Lens", "2x LP-E6N Batteries", "1x 128GB High-End SD Card", "Battery Charger", "Shoulder Bag"]'::jsonb,
      31
    )
  ON CONFLICT (id) DO NOTHING;

  -- 3. RESERVATIONS
  INSERT INTO public.reservations (
    id, reference_no, customer_id, camera_id, start_date, end_date,
    total_days, daily_rate_snapshot, subtotal_php, security_deposit_php, total_amount_php,
    purpose, status
  ) VALUES
    (
      res1_id,
      'IDIO-882194',
      cust_uid,
      'CAM-001',
      '2026-10-12',
      '2026-10-14',
      3,
      1450.00,
      4350.00,
      3000.00,
      7350.00,
      'Commercial photoshoot at Guingona Park & Lake Mainit eco-tour',
      'APPROVED'
    ),
    (
      res2_id,
      'IDIO-541289',
      cust_uid,
      'CAM-003',
      '2026-10-18',
      '2026-10-20',
      3,
      1250.00,
      3750.00,
      2500.00,
      6250.00,
      'Balangay Festival cultural documentation & street portraiture',
      'PENDING_APPROVAL'
    ),
    (
      res3_id,
      'IDIO-331902',
      cust_uid,
      'CAM-004',
      '2026-09-20',
      '2026-09-22',
      3,
      750.00,
      2250.00,
      1500.00,
      3750.00,
      'Campus documentary vlog & interview series',
      'APPROVED'
    )
  ON CONFLICT (id) DO NOTHING;

  -- 4. PAYMENTS & DEPOSITS RECORD
  INSERT INTO public.payments_and_deposits (
    reservation_id, rental_amount_php, payment_method, payment_status,
    payment_reference, security_deposit_php, deposit_status
  ) VALUES
    (res1_id, 4350.00, 'GCASH', 'PAID', 'GC-99384729104', 3000.00, 'HELD'),
    (res2_id, 3750.00, 'CASH_PICKUP', 'PENDING', NULL, 2500.00, 'HELD'),
    (res3_id, 2250.00, 'GCASH', 'PAID', 'GC-1199482019', 1500.00, 'REFUNDED')
  ON CONFLICT (reservation_id) DO NOTHING;

  -- 5. COMPLETED RENTAL
  INSERT INTO public.rentals (
    reservation_id, camera_id, customer_id, checkout_admin_id, checkout_condition,
    checkout_notes, checked_out_at, status, return_admin_id, return_condition,
    return_inspection_notes, returned_at, completed_at
  ) VALUES
    (
      res3_id,
      'CAM-004',
      cust_uid,
      admin_uid,
      'Good',
      'Accessories and lens caps verified at counter.',
      '2026-09-20 08:30:00+08',
      'COMPLETED',
      admin_uid,
      'Good',
      'All accessories returned in complete order. Sensor and screen inspected clean.',
      '2026-09-22 17:45:00+08',
      '2026-09-22 17:50:00+08'
    )
  ON CONFLICT (reservation_id) DO NOTHING;

  -- 6. MAINTENANCE TICKETS
  INSERT INTO public.maintenance_tickets (
    id, camera_id, issue_type, severity, description, cost_estimate_php,
    status, reported_by_admin_id, start_date, completion_date, technician_notes
  ) VALUES
    (
      'MNT-2026-01',
      'CAM-002',
      'Sensor Cleaning',
      'Low',
      'Routine wet-swab sensor cleaning and contact point lubrication.',
      450.00,
      'Completed',
      admin_uid,
      '2026-09-25',
      '2026-09-26',
      'Sensor verified speck-free at f/22 aperture test.'
    ),
    (
      'MNT-2026-02',
      'CAM-006',
      'Firmware Update',
      'Low',
      'Official firmware update v1.62 applied for improved Eye-AF performance.',
      0.00,
      'Completed',
      admin_uid,
      '2026-10-01',
      '2026-10-01',
      'Tested and verified operational.'
    )
  ON CONFLICT (id) DO NOTHING;

  -- 7. AUDIT LOGS
  INSERT INTO public.activity_audit_logs (
    actor_id, actor_name, actor_role, action, details, target_type, target_id
  ) VALUES
    (cust_uid, 'Jennelyn Photographer', 'CUSTOMER', 'CREATED_RESERVATION', 'Submitted reservation request for Fujifilm X-T5 (Oct 18 - Oct 20, 2026)', 'RESERVATION', res2_id::text),
    (admin_uid, 'Dave Admin (Owner)', 'ADMIN', 'APPROVED_RESERVATION', 'Approved reservation IDIO-882194 for Sony Alpha 7 IV (GCash Payment Verified)', 'RESERVATION', res1_id::text),
    (admin_uid, 'Dave Admin (Owner)', 'ADMIN', 'PROCESSED_RETURN', 'Inspected return for Sony ZV-E10. Condition: Good. Security deposit ₱1,500 refunded to customer.', 'RESERVATION', res3_id::text);

END $$;
