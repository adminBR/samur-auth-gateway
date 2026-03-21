ALTER TABLE services_info
ADD COLUMN IF NOT EXISTS srv_category text;

UPDATE services_info
SET srv_category = 'cpoe'
WHERE srv_category IS NULL OR trim(srv_category) = '';

ALTER TABLE services_info
ALTER COLUMN srv_category SET DEFAULT 'cpoe';

ALTER TABLE services_info
ALTER COLUMN srv_category SET NOT NULL;
