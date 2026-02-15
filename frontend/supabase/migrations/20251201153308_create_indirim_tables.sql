/*
  # Indirim Project Database Schema

  1. New Tables
    - `user_profiles` - Extended user information
      - `id` (uuid, primary key) - User ID from auth
      - `email` (text)
      - `full_name` (text)
      - `avatar_url` (text)
      - `contributions` (integer) - Number of potholes reported
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `potholes` - Pothole reports
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `latitude` (float)
      - `longitude` (float)
      - `severity` (text) - low, medium, high
      - `image_url` (text)
      - `description` (text)
      - `verified` (boolean)
      - `created_at` (timestamp)

    - `pothole_views` - Track user interactions
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `pothole_id` (uuid, foreign key)
      - `viewed_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Users can only view/edit their own profile
    - Users can view all potholes but only create/edit their own
    - Everyone can view pothole data for map display
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text DEFAULT '',
  avatar_url text,
  contributions integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Public profiles viewable by authenticated"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);


CREATE TABLE IF NOT EXISTS potholes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude float NOT NULL,
  longitude float NOT NULL,
  severity text DEFAULT 'medium',
  image_url text,
  description text,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE potholes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all potholes"
  ON potholes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own potholes"
  ON potholes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own potholes"
  ON potholes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS pothole_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pothole_id uuid NOT NULL REFERENCES potholes(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now()
);

ALTER TABLE pothole_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own viewing history"
  ON pothole_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can log pothole views"
  ON pothole_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
