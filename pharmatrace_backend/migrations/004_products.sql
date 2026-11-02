-- Reference catalogue of Rwanda FDA-registered products. Batches point at a product, and the
-- batch form derives drug name, strength, dosage form and category from it.
-- NOTE: shelf_life_months drives batch expiry (mfg date + shelf life). The registry's own
-- "expiry" is the product REGISTRATION validity, not a batch expiry, so it is stored separately.
CREATE TABLE IF NOT EXISTS products (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number  varchar(40)  NOT NULL UNIQUE,
  brand_name           varchar(150) NOT NULL,
  generic_name         varchar(200) NOT NULL,
  strength             varchar(80)  NOT NULL,
  dosage_form          varchar(40)  NOT NULL,
  pack_size            varchar(160) NOT NULL,
  shelf_life_months    integer      NOT NULL CHECK (shelf_life_months > 0),
  category             varchar(30)  NOT NULL CHECK (category IN ('Antimalarial','Antibiotic','ARV')),
  manufacturer_name    varchar(150) NOT NULL,
  country              varchar(60)  NOT NULL,
  registration_date    date,
  registration_expiry  date,
  source_review_status varchar(30),
  created_at           timestamp NOT NULL DEFAULT now(),
  updated_at           timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category);
CREATE INDEX IF NOT EXISTS products_brand_idx ON products (lower(brand_name));

ALTER TABLE batches ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id);
CREATE INDEX IF NOT EXISTS batches_product_idx ON batches (product_id);

-- Mirror the contract's BatchStatus so bad values cannot be written.
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_chk;
ALTER TABLE batches ADD CONSTRAINT batches_status_chk
  CHECK (status IN ('pending','approved','flagged','revoked'));
