-- Add connection status fields to sites table
ALTER TABLE sites 
ADD COLUMN connection_status VARCHAR(20) DEFAULT 'disconnected',
ADD COLUMN last_connected_at TIMESTAMP,
ADD COLUMN connection_error TEXT,
ADD COLUMN retry_count INTEGER DEFAULT 0;

-- Create connection_logs table
CREATE TABLE connection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  attempted_at TIMESTAMP DEFAULT NOW() NOT NULL,
  success BOOLEAN NOT NULL
);

-- Create index for faster queries
CREATE INDEX idx_connection_logs_site_id ON connection_logs(site_id);
CREATE INDEX idx_connection_logs_attempted_at ON connection_logs(attempted_at DESC);
CREATE INDEX idx_sites_connection_status ON sites(connection_status);