-- =====================================================================
-- Citizen Grievance Classification System — Database Setup + Seed Data
-- Run this entire script in your `grievance_db=#` SQL Shell (or via
-- `psql -d grievance_db -f seed_grievance_db.sql`).
-- Safe to re-run: it drops and recreates tables each time.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SECTION 0: Extensions
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- SECTION 1: Drop existing tables (clean slate, respects FK order)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS complaint_updates CASCADE;
DROP TABLE IF EXISTS grievances CASCADE;
DROP TABLE IF EXISTS otp_verifications CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS userrole CASCADE;
DROP TYPE IF EXISTS category CASCADE;
DROP TYPE IF EXISTS status CASCADE;

-- ---------------------------------------------------------------------
-- SECTION 2: Enum types
-- ---------------------------------------------------------------------
CREATE TYPE userrole AS ENUM ('citizen', 'admin');

CREATE TYPE category AS ENUM (
    'water_supply', 'electricity', 'roads', 'sanitation',
    'public_safety', 'street_lights', 'garbage_waste', 'waterlogging', 'blocked_drain', 'out_of_scope'
);

CREATE TYPE status AS ENUM ('unsolved', 'in_progress', 'solved', 'rejected');

-- ---------------------------------------------------------------------
-- SECTION 3: CREATE TABLE statements
-- ---------------------------------------------------------------------

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role userrole NOT NULL DEFAULT 'citizen',
    reputation_score FLOAT DEFAULT 100.0,
    is_banned BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_users_phone ON users(phone);

CREATE TABLE otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(15) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    attempt_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_otp_phone ON otp_verifications(phone);

CREATE TABLE grievances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    image_url VARCHAR(500),
    location VARCHAR(500),
    category category NOT NULL DEFAULT 'out_of_scope',
    department VARCHAR(100),
    urgency_score INTEGER DEFAULT 1,
    confidence FLOAT DEFAULT 0.0,
    status status NOT NULL DEFAULT 'unsolved',
    is_duplicate BOOLEAN DEFAULT FALSE,
    similar_complaint_ids TEXT[] DEFAULT '{}',
    is_ai_overridden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_grievances_user ON grievances(user_id);
CREATE INDEX idx_grievances_category ON grievances(category);
CREATE INDEX idx_grievances_status ON grievances(status);

CREATE TABLE complaint_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grievance_id UUID NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
    status status NOT NULL,
    message TEXT,
    progress_image_url VARCHAR(500),
    timestamp TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_updates_grievance ON complaint_updates(grievance_id);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    grievance_id UUID REFERENCES grievances(id),
    message TEXT NOT NULL,
    channel VARCHAR(20) DEFAULT 'sms',
    sent BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- SECTION 4: Seed data — Users
-- All dummy accounts share the password: Password123
-- ---------------------------------------------------------------------
INSERT INTO users (id, phone, email, password_hash, role, reputation_score, is_banned, is_phone_verified) VALUES
('f400dc11-d2a2-4d27-b9df-22317cf719fb', '+919876543210', 'priya.sharma@example.com', '$2b$12$Ml5cIncfQ8/qJqP1.hF1F.1/5o/RmXSG.OEX7g8wOOHSj7yZn7NlW', 'citizen', 100.0, FALSE, TRUE),
('08d6e5bc-ebe4-4c1e-843b-0466c3255c61', '+919876543211', 'arun.kumar@example.com',   '$2b$12$Ml5cIncfQ8/qJqP1.hF1F.1/5o/RmXSG.OEX7g8wOOHSj7yZn7NlW', 'citizen', 95.0,  FALSE, TRUE),
('ebb86588-4b8c-48c6-805d-432c937e23bf', '+919876543212', 'lakshmi.iyer@example.com', '$2b$12$Ml5cIncfQ8/qJqP1.hF1F.1/5o/RmXSG.OEX7g8wOOHSj7yZn7NlW', 'citizen', 88.0,  FALSE, TRUE),
('5efce8f6-c1a6-4fd4-af5c-5032555f0fd1', '+919876543213', 'rahul.verma@example.com',  '$2b$12$Ml5cIncfQ8/qJqP1.hF1F.1/5o/RmXSG.OEX7g8wOOHSj7yZn7NlW', 'citizen', 60.0,  FALSE, TRUE),
('086c9b5c-76d1-4695-a2ec-c41c24b1be77', '+919876543214', 'sneha.reddy@example.com',  '$2b$12$Ml5cIncfQ8/qJqP1.hF1F.1/5o/RmXSG.OEX7g8wOOHSj7yZn7NlW', 'citizen', 100.0, FALSE, TRUE),
('c95e30f8-1f6f-419a-a9ac-d33118fe65bb', '+919876543220', 'admin.officer1@example.com', '$2b$12$Ml5cIncfQ8/qJqP1.hF1F.1/5o/RmXSG.OEX7g8wOOHSj7yZn7NlW', 'admin', 100.0, FALSE, TRUE),
('e2cadf2e-afb4-49d7-ae52-338ddd2beaa1', '+919876543221', 'admin.officer2@example.com', '$2b$12$Ml5cIncfQ8/qJqP1.hF1F.1/5o/RmXSG.OEX7g8wOOHSj7yZn7NlW', 'admin', 100.0, FALSE, TRUE);

-- ---------------------------------------------------------------------
-- SECTION 5: Seed data — OTP verifications (pre-verified, mock OTP 123456)
-- ---------------------------------------------------------------------
INSERT INTO otp_verifications (phone, otp_hash, expires_at, verified, attempt_count) VALUES
('+919876543210', '$2b$12$VR1uVIh/8Zi8QYVJDTFmLed.TEZ3ZKHeENrJjhnmc8w5tOXrRtMQ.', NOW() + INTERVAL '5 minutes', TRUE, 1),
('+919876543211', '$2b$12$VR1uVIh/8Zi8QYVJDTFmLed.TEZ3ZKHeENrJjhnmc8w5tOXrRtMQ.', NOW() + INTERVAL '5 minutes', TRUE, 1),
('+919876543212', '$2b$12$VR1uVIh/8Zi8QYVJDTFmLed.TEZ3ZKHeENrJjhnmc8w5tOXrRtMQ.', NOW() + INTERVAL '5 minutes', TRUE, 1),
('+919876543213', '$2b$12$VR1uVIh/8Zi8QYVJDTFmLed.TEZ3ZKHeENrJjhnmc8w5tOXrRtMQ.', NOW() + INTERVAL '5 minutes', TRUE, 1),
('+919876543214', '$2b$12$VR1uVIh/8Zi8QYVJDTFmLed.TEZ3ZKHeENrJjhnmc8w5tOXrRtMQ.', NOW() + INTERVAL '5 minutes', TRUE, 1),
('+919876543220', '$2b$12$VR1uVIh/8Zi8QYVJDTFmLed.TEZ3ZKHeENrJjhnmc8w5tOXrRtMQ.', NOW() + INTERVAL '5 minutes', TRUE, 1),
('+919876543221', '$2b$12$VR1uVIh/8Zi8QYVJDTFmLed.TEZ3ZKHeENrJjhnmc8w5tOXrRtMQ.', NOW() + INTERVAL '5 minutes', TRUE, 1);

-- ---------------------------------------------------------------------
-- SECTION 6: Seed data — Grievances (valid + duplicates)
-- ---------------------------------------------------------------------
INSERT INTO grievances (id, user_id, text, location, category, department, urgency_score, confidence, status, is_duplicate, similar_complaint_ids, created_at) VALUES
('e9686639-a236-43c6-9046-e1ad58304f60', 'f400dc11-d2a2-4d27-b9df-22317cf719fb', 'There is a major water pipe leak on Anna Salai near the bus stop causing flooding on the road.', '13.0604,80.2496', 'water_supply', 'Water Supply Department', 8, 0.91, 'unsolved', TRUE, ARRAY['876642fb-c501-4345-a2fa-c1ec9bdb85ea'], NOW() - INTERVAL '2 days'),
('876642fb-c501-4345-a2fa-c1ec9bdb85ea', '08d6e5bc-ebe4-4c1e-843b-0466c3255c61', 'There is a major water pipe leak on Anna Salai near the bus stop causing flooding on the road.', '13.0605,80.2497', 'water_supply', 'Water Supply Department', 8, 0.89, 'unsolved', TRUE, ARRAY['e9686639-a236-43c6-9046-e1ad58304f60'], NOW() - INTERVAL '1 day'),
('8d8c4d56-3bd5-4d97-b037-48bfa79944aa', 'ebb86588-4b8c-48c6-805d-432c937e23bf', 'The street light outside block C in Adyar has been non-functional for two weeks now.', 'Adyar, Chennai', 'street_lights', 'Electricity Board (Street Lighting)', 4, 0.85, 'in_progress', TRUE, ARRAY['0bf69429-53fa-49d7-b406-bc6475d5a40b'], NOW() - INTERVAL '10 days'),
('0bf69429-53fa-49d7-b406-bc6475d5a40b', '5efce8f6-c1a6-4fd4-af5c-5032555f0fd1', 'The street light outside block C in Adyar has been non-functional for two weeks now.', 'Adyar, Chennai', 'street_lights', 'Electricity Board (Street Lighting)', 4, 0.85, 'unsolved', TRUE, ARRAY['8d8c4d56-3bd5-4d97-b037-48bfa79944aa'], NOW() - INTERVAL '3 days'),
('2cb02ab5-0580-4da3-ba39-fcb973afa3f7', 'f400dc11-d2a2-4d27-b9df-22317cf719fb', 'Frequent power outages in Velachery for the past week, sometimes lasting six hours at a stretch.', 'Velachery, Chennai', 'electricity', 'Electricity Board', 6, 0.82, 'in_progress', FALSE, '{}', NOW() - INTERVAL '6 days'),
('fb927798-b0fa-4005-b5d0-79b06e83b143', '08d6e5bc-ebe4-4c1e-843b-0466c3255c61', 'Large pothole on the main road near Guindy signal has caused two accidents this month already.', 'Guindy, Chennai', 'roads', 'Public Works Department (Roads)', 9, 0.93, 'unsolved', FALSE, '{}', NOW() - INTERVAL '1 day'),
('954631dd-0f8f-48e0-ad64-1bbcb3f615be', 'ebb86588-4b8c-48c6-805d-432c937e23bf', 'Open sewage drain near the school in Mylapore is overflowing and creating a severe health hazard for children.', 'Mylapore, Chennai', 'sanitation', 'Sanitation Department', 9, 0.90, 'unsolved', FALSE, '{}', NOW() - INTERVAL '12 hours'),
('8fe74196-8ad9-490b-8927-9c0c6b9bc16c', '5efce8f6-c1a6-4fd4-af5c-5032555f0fd1', 'Garbage has not been collected on our street in T Nagar for over ten days and is starting to smell badly.', 'T Nagar, Chennai', 'garbage_waste', 'Solid Waste Management', 5, 0.88, 'solved', FALSE, '{}', NOW() - INTERVAL '15 days'),
('75501152-ca17-44fd-8ef9-4533d1e36244', '086c9b5c-76d1-4695-a2ec-c41c24b1be77', 'An unguarded open manhole on the footpath near the market in Tambaram is extremely dangerous for pedestrians at night.', 'Tambaram, Chennai', 'public_safety', 'Public Safety / Municipal Enforcement', 10, 0.95, 'in_progress', FALSE, '{}', NOW() - INTERVAL '4 days'),
('6e0259d6-1b69-44d4-b3d1-cc882e9e60e4', 'f400dc11-d2a2-4d27-b9df-22317cf719fb', 'Water supply has been irregular for the past month in our apartment complex, arriving only once every three days.', 'Kodambakkam, Chennai', 'water_supply', 'Water Supply Department', 6, 0.80, 'solved', FALSE, '{}', NOW() - INTERVAL '20 days'),
('502c7abf-77ec-44c5-a2aa-5491327e863d', '08d6e5bc-ebe4-4c1e-843b-0466c3255c61', 'The footpath near the railway station in Egmore has been broken and uneven for months, making it hard for elderly people to walk.', 'Egmore, Chennai', 'roads', 'Public Works Department (Roads)', 3, 0.78, 'unsolved', FALSE, '{}', NOW() - INTERVAL '7 days'),
('0c67f15e-8c99-4e88-bcc8-442fe5dc1da5', '086c9b5c-76d1-4695-a2ec-c41c24b1be77', 'A transformer near our street in Nungambakkam has been sparking intermittently, which feels unsafe especially during rain.', 'Nungambakkam, Chennai', 'electricity', 'Electricity Board', 8, 0.87, 'unsolved', FALSE, '{}', NOW() - INTERVAL '2 days'),
('967a62d8-00ef-4497-80b2-a7ab29295228', '086c9b5c-76d1-4695-a2ec-c41c24b1be77', 'Gas leak smell reported near the residential block in Anna Nagar, residents are worried about safety and want urgent inspection.', 'Anna Nagar, Chennai', 'public_safety', 'Public Safety / Municipal Enforcement', 10, 0.94, 'unsolved', FALSE, '{}', NOW() - INTERVAL '3 hours');

-- Out-of-scope grievances (auto-rejected)
INSERT INTO grievances (id, user_id, text, location, category, department, urgency_score, confidence, status, is_duplicate, similar_complaint_ids, created_at) VALUES
('dd7cf555-de05-413b-9e08-bf9c52da4521', '5efce8f6-c1a6-4fd4-af5c-5032555f0fd1', 'My neighbor stole my bicycle from outside my house last night and I want this reported and investigated immediately.', 'Perambur, Chennai', 'out_of_scope', NULL, 1, 0.65, 'rejected', FALSE, '{}', NOW() - INTERVAL '5 days'),
('09d88508-4219-4eb1-86eb-1595f978cb53', 'ebb86588-4b8c-48c6-805d-432c937e23bf', 'I am unemployed and looking for a government job, please help me find employment through this portal.', 'Chennai', 'out_of_scope', NULL, 1, 0.70, 'rejected', FALSE, '{}', NOW() - INTERVAL '9 days'),
('de4ae794-4ffd-464b-8fb0-375e3f9cc19d', '5efce8f6-c1a6-4fd4-af5c-5032555f0fd1', 'I strongly disagree with the current local political party and think the upcoming election results will be unfair.', 'Chennai', 'out_of_scope', NULL, 1, 0.60, 'rejected', FALSE, '{}', NOW() - INTERVAL '11 days');

-- ---------------------------------------------------------------------
-- SECTION 7: Seed data — Complaint updates
-- ---------------------------------------------------------------------
INSERT INTO complaint_updates (grievance_id, status, message, timestamp) VALUES
('8d8c4d56-3bd5-4d97-b037-48bfa79944aa',  'in_progress', 'Electrician dispatched to inspect the street light fixture.', NOW() - INTERVAL '8 days'),
('2cb02ab5-0580-4da3-ba39-fcb973afa3f7',  'in_progress', 'Substation team assigned to investigate the outage cause.', NOW() - INTERVAL '5 days'),
('8fe74196-8ad9-490b-8927-9c0c6b9bc16c',  'in_progress', 'Waste collection truck rerouted to cover the missed street.', NOW() - INTERVAL '13 days'),
('8fe74196-8ad9-490b-8927-9c0c6b9bc16c',  'solved',      'Garbage collected and daily pickup schedule restored.', NOW() - INTERVAL '11 days'),
('75501152-ca17-44fd-8ef9-4533d1e36244',  'in_progress', 'Barricades placed around the manhole; repair crew scheduled.', NOW() - INTERVAL '3 days'),
('6e0259d6-1b69-44d4-b3d1-cc882e9e60e4', 'in_progress', 'Valve issue identified at the local distribution point.', NOW() - INTERVAL '18 days'),
('6e0259d6-1b69-44d4-b3d1-cc882e9e60e4', 'solved',      'Valve repaired; regular daily supply resumed.', NOW() - INTERVAL '16 days');

-- ---------------------------------------------------------------------
-- SECTION 8: Seed data — Notifications
-- ---------------------------------------------------------------------
INSERT INTO notifications (user_id, grievance_id, message, channel, sent, timestamp) VALUES
('f400dc11-d2a2-4d27-b9df-22317cf719fb', 'e9686639-a236-43c6-9046-e1ad58304f60',  'Your complaint has been received and classified as water_supply (urgency 8/10) and assigned to Water Supply Department.', 'sms', TRUE, NOW() - INTERVAL '2 days'),
('08d6e5bc-ebe4-4c1e-843b-0466c3255c61', '876642fb-c501-4345-a2fa-c1ec9bdb85ea',  'Your complaint has been received and classified as water_supply (urgency 8/10) and assigned to Water Supply Department.', 'sms', TRUE, NOW() - INTERVAL '1 day'),
('ebb86588-4b8c-48c6-805d-432c937e23bf', '8d8c4d56-3bd5-4d97-b037-48bfa79944aa',  'Your complaint is now in progress. Note: Electrician dispatched to inspect the street light fixture.', 'sms', TRUE, NOW() - INTERVAL '8 days'),
('5efce8f6-c1a6-4fd4-af5c-5032555f0fd1', '8fe74196-8ad9-490b-8927-9c0c6b9bc16c',  'Your complaint has been resolved. Thank you for reporting it.', 'sms', TRUE, NOW() - INTERVAL '11 days'),
('086c9b5c-76d1-4695-a2ec-c41c24b1be77', '75501152-ca17-44fd-8ef9-4533d1e36244',  'Your complaint is now in progress. Note: Barricades placed around the manhole; repair crew scheduled.', 'sms', TRUE, NOW() - INTERVAL '3 days'),
('f400dc11-d2a2-4d27-b9df-22317cf719fb', '6e0259d6-1b69-44d4-b3d1-cc882e9e60e4', 'Your complaint has been resolved. Thank you for reporting it.', 'sms', TRUE, NOW() - INTERVAL '16 days'),
('5efce8f6-c1a6-4fd4-af5c-5032555f0fd1', 'dd7cf555-de05-413b-9e08-bf9c52da4521', 'This looks like a criminal matter. Please contact the police (dial 100) or file an FIR.', 'sms', TRUE, NOW() - INTERVAL '5 days'),
('ebb86588-4b8c-48c6-805d-432c937e23bf', '09d88508-4219-4eb1-86eb-1595f978cb53', 'This looks like an employment request. Please contact your local employment exchange.', 'sms', TRUE, NOW() - INTERVAL '9 days');
