-- Base schema (users, manufacturers, batches, serials, scan_events, flag_reports, password_resets, audit_log).
-- Exported from the original Neon database, then tidied so a fresh PostgreSQL 13+ database can be built from it.
-- Run the migration files in order: 001, then 002 to 007 (see the README).

CREATE SEQUENCE IF NOT EXISTS audit_log_seq_seq;

-- audit_log
CREATE TABLE audit_log (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    actor_id uuid,
    actor_wallet character varying(42),
    action character varying(40) NOT NULL,
    entity_type character varying(20) NOT NULL,
    entity_id character varying(80),
    tx_hash character varying(66),
    details jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    seq bigint NOT NULL DEFAULT nextval('audit_log_seq_seq'::regclass),
    ts_ms bigint NOT NULL,
    prev_hash character(64) NOT NULL,
    row_hash character(64) NOT NULL,
    CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX audit_log_seq_key ON public.audit_log USING btree (seq);

-- batches
CREATE TABLE batches (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    manufacturer_id uuid NOT NULL,
    batch_no character varying(64) NOT NULL,
    gtin character varying(14) NOT NULL,
    drug_name character varying(150) NOT NULL,
    category character varying(30) NOT NULL,
    mfg_date date NOT NULL,
    expiry_date date NOT NULL,
    quantity integer NOT NULL,
    batch_id_hash character varying(66) NOT NULL,
    metadata_hash character varying(66) NOT NULL,
    status character varying(10) NOT NULL DEFAULT 'pending'::character varying,
    submit_tx_hash character varying(66),
    created_by uuid,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT batches_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX batches_batch_id_hash_key ON public.batches USING btree (batch_id_hash);
CREATE UNIQUE INDEX batches_manufacturer_id_batch_no_key ON public.batches USING btree (manufacturer_id, batch_no);

-- flag_reports
CREATE TABLE flag_reports (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    batch_id character varying(255) NOT NULL,
    flagged_by uuid,
    reason text NOT NULL,
    image_url character varying(255),
    reported_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resolved boolean DEFAULT false,
    location character varying(255),
    image_key character varying(255),
    status character varying(20) NOT NULL DEFAULT 'open'::character varying,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    review_note text,
    CONSTRAINT flag_reports_pkey PRIMARY KEY (id)
);

-- manufacturers
CREATE TABLE manufacturers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying(150) NOT NULL,
    license_number character varying(80) NOT NULL,
    license_hash character varying(66) NOT NULL,
    wallet_address character varying(42) NOT NULL,
    contact_email character varying(150),
    status character varying(10) NOT NULL DEFAULT 'pending'::character varying,
    register_tx_hash character varying(66),
    created_by uuid,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    country character varying(60) NOT NULL DEFAULT 'Rwanda'::character varying,
    approved_at timestamp without time zone,
    revoked_at timestamp without time zone,
    revoke_tx_hash character varying(66),
    CONSTRAINT manufacturers_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX manufacturers_license_number_key ON public.manufacturers USING btree (license_number);
CREATE UNIQUE INDEX manufacturers_wallet_address_key ON public.manufacturers USING btree (wallet_address);

-- password_resets
CREATE TABLE password_resets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    CONSTRAINT password_resets_pkey PRIMARY KEY (id)
);

-- scan_events
CREATE TABLE scan_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    batch_uuid uuid,
    serial character varying(20),
    raw_code text,
    sector character varying(50),
    verdict character varying(12) NOT NULL,
    scanned_by uuid,
    scanned_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT scan_events_pkey PRIMARY KEY (id)
);
CREATE INDEX scan_events_serial_idx ON public.scan_events USING btree (batch_uuid, serial, scanned_at);

-- serials
CREATE TABLE serials (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    batch_uuid uuid NOT NULL,
    serial character varying(20) NOT NULL,
    status character varying(10) NOT NULL DEFAULT 'active'::character varying,
    dispensed_at timestamp without time zone,
    dispensed_by uuid,
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT serials_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX serials_batch_uuid_serial_key ON public.serials USING btree (batch_uuid, serial);

-- users
CREATE TABLE users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    wallet_address character varying(255),
    contact character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    sector character varying(255),
    profile_pic_key character varying(255),
    is_active boolean NOT NULL DEFAULT true,
    must_change_password boolean NOT NULL DEFAULT false,
    last_login timestamp without time zone,
    manufacturer_id uuid,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX users_contact_key ON public.users USING btree (contact);

-- Foreign keys are added last because users and manufacturers refer to each other.
ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users (id);
ALTER TABLE batches ADD CONSTRAINT batches_manufacturer_id_fkey FOREIGN KEY (manufacturer_id) REFERENCES manufacturers (id);
ALTER TABLE batches ADD CONSTRAINT batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id);
ALTER TABLE flag_reports ADD CONSTRAINT flag_reports_flagged_by_fkey FOREIGN KEY (flagged_by) REFERENCES users (id);
ALTER TABLE flag_reports ADD CONSTRAINT flag_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users (id);
ALTER TABLE manufacturers ADD CONSTRAINT manufacturers_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id);
ALTER TABLE password_resets ADD CONSTRAINT password_resets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE scan_events ADD CONSTRAINT scan_events_batch_uuid_fkey FOREIGN KEY (batch_uuid) REFERENCES batches (id);
ALTER TABLE scan_events ADD CONSTRAINT scan_events_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES users (id);
ALTER TABLE serials ADD CONSTRAINT serials_batch_uuid_fkey FOREIGN KEY (batch_uuid) REFERENCES batches (id);
ALTER TABLE serials ADD CONSTRAINT serials_dispensed_by_fkey FOREIGN KEY (dispensed_by) REFERENCES users (id);
ALTER TABLE users ADD CONSTRAINT users_manufacturer_id_fkey FOREIGN KEY (manufacturer_id) REFERENCES manufacturers (id);
